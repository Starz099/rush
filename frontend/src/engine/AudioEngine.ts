import * as MP4Box from 'mp4box'
import { invoke } from '@tauri-apps/api/core'

export class AudioEngine {
  private mp4boxfile: any
  private decoder: AudioDecoder
  private audioCtx: AudioContext
  private filePath: string
  private decoderConfigured = false
  private disposed = false

  private samples: any[] = []
  private currentSampleIndex = 0
  private audioTrack: any
  private timescale: number = 1

  constructor(filePath: string, context: AudioContext) {
    this.filePath = filePath
    this.audioCtx = context
    this.mp4boxfile = MP4Box.createFile()

    this.decoder = new AudioDecoder({
      output: (data: AudioData) => {
        if (this.disposed) {
          data.close()
          return
        }
        this.scheduleAudioData(data)
      },
      error: (e) => console.error('Audio Decoder error:', e),
    })
  }

  public dispose() {
    this.disposed = true
    if (this.decoder.state !== 'closed') {
      this.decoder.close()
    }
  }

  public async initialize(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.mp4boxfile.onReady = (info: any) => {
        this.audioTrack = info.audioTracks[0]
        if (!this.audioTrack) return reject('No audio track found')

        this.timescale = this.audioTrack.timescale || info.timescale || 1

        this.mp4boxfile.setExtractionOptions(this.audioTrack.id, null, {
          nbSamples: 10000,
        })
        this.mp4boxfile.start()

        resolve({
          codec: this.audioTrack.codec,
          sampleRate: this.audioTrack.audio.sample_rate,
          channels: this.audioTrack.audio.channel_count,
          timescale: this.timescale,
        })
      }

      this.mp4boxfile.onSamples = (
        _track_id: number,
        _user: any,
        samples: any[],
      ) => {
        if (this.disposed) return
        this.samples.push(...samples)
      }

      this.mp4boxfile.onError = (e: string) => reject(e)

      this.fetchAndFeed()
    })
  }

  private activeSources: AudioBufferSourceNode[] = []

  public stop() {
    this.activeSources.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch (e) {
        // Source might have already finished
      }
    })
    this.activeSources = []
  }

  public decodeNextBatch(count: number = 5) {
    if (this.decoder.state === 'closed' || this.disposed) return

    // Don't buffer too far ahead (e.g., 0.5 seconds)
    // This prevents the "upcoming part" issue if the decoder is too fast
    const lookaheadSeconds = 0.5
    const maxTimestamp =
      (this.audioCtx.currentTime -
        this.playbackStartTime +
        this.playbackStartPlayheadTime +
        lookaheadSeconds) *
      1_000_000

    for (let i = 0; i < count; i++) {
      if (this.currentSampleIndex < this.samples.length) {
        const sample = this.samples[this.currentSampleIndex]
        const sampleTimestampInMicroseconds =
          (sample.cts * 1_000_000) / this.timescale

        if (sampleTimestampInMicroseconds > maxTimestamp) break

        this.decodeAtIndex(this.currentSampleIndex)
        this.currentSampleIndex++
      }
    }
  }

  public seekByTime(timeInSeconds: number) {
    if (this.disposed || !this.samples.length) return

    // Convert time to timescale units for comparison with sample.cts
    const targetCts = timeInSeconds * this.timescale
    let targetIndex = this.samples.findIndex(
      (s) => s.cts <= targetCts && s.cts + s.duration > targetCts,
    )

    if (targetIndex === -1) {
      if (targetCts < this.samples[0].cts) targetIndex = 0
      else targetIndex = this.samples.length - 1
    }

    this.seek(targetIndex)
  }

  public seek(sampleIndex: number) {
    if (
      this.disposed ||
      sampleIndex < 0 ||
      sampleIndex >= this.samples.length
    ) {
      return
    }

    let syncIndex = sampleIndex
    while (syncIndex > 0 && !this.samples[syncIndex].is_sync) {
      syncIndex--
    }

    if (this.decoder.state !== 'unconfigured') {
      this.decoder.reset()
      this.decoderConfigured = false
    }

    for (let i = syncIndex; i <= sampleIndex; i++) {
      this.decodeAtIndex(i)
    }

    this.currentSampleIndex = sampleIndex + 1
  }

  private decodeAtIndex(index: number) {
    if (this.disposed || index < 0 || index >= this.samples.length) return

    const sample = this.samples[index]

    if (!this.decoderConfigured) {
      const config: AudioDecoderConfig = {
        codec: this.audioTrack.codec,
        sampleRate: this.audioTrack.audio.sample_rate,
        numberOfChannels: this.audioTrack.audio.channel_count,
      }

      const description = this.getAudioDescription(sample)
      if (description) {
        config.description = description
      }

      this.decoder.configure(config)
      this.decoderConfigured = true
    }

    const chunk = new EncodedAudioChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / this.timescale,
      duration: (sample.duration * 1_000_000) / this.timescale,
      data: sample.data,
    })

    this.decoder.decode(chunk)
  }

  private getAudioDescription(sample: any): ArrayBufferLike | null {
    // 1. Try to get it directly from the sample description
    const esds = sample?.description?.esds
    if (esds?.data) {
      return this.extractAudioSpecificConfig(esds.data)
    }

    // 2. Fallback: try to find it in the track structure
    try {
      const moov = this.mp4boxfile.moov
      if (moov) {
        const trak = moov.traks.find(
          (t: any) => t.tkhd.track_id === this.audioTrack.id,
        )
        const stsdEntry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]
        const fallbackEsds = stsdEntry?.esds
        if (fallbackEsds?.data) {
          return this.extractAudioSpecificConfig(fallbackEsds.data)
        }
      }
    } catch (e) {
      console.warn('Failed to find esds in moov fallback:', e)
    }

    return null
  }

  private extractAudioSpecificConfig(data: Uint8Array): ArrayBufferLike | null {
    // The esds box (Elementary Stream Descriptor) has a nested structure:
    // ES_Descriptor -> DecoderConfigDescriptor -> DecoderSpecificInfo (AudioSpecificConfig)
    // We need to find the tag 0x05 (DecoderSpecificInfoTag)
    let offset = 0
    while (offset < data.length) {
      const tag = data[offset]

      // Tag 0x03 is ES_DescriptorTag
      // Tag 0x04 is DecoderConfigDescriptorTag
      // Tag 0x05 is DecoderSpecificInfoTag (This is what we want)

      if (tag === 0x05) {
        // Tag found! The next byte(s) are the length.
        // mp4box handles some length parsing, but let's be safe.
        // Simple length check (1 byte length)
        const len = data[offset + 1]
        if (len > 0 && offset + 2 + len <= data.length) {
          return data.buffer.slice(
            data.byteOffset + offset + 2,
            data.byteOffset + offset + 2 + len,
          )
        }
      }
      offset++
    }
    return null
  }

  private async fetchAndFeed() {
    try {
      const fileBytes = await invoke<number[]>('read_asset_bytes', {
        filePath: this.filePath,
      })
      const buffer = new Uint8Array(fileBytes).buffer
      ;(buffer as any).fileStart = 0

      this.mp4boxfile.appendBuffer(buffer)
      this.mp4boxfile.flush()
    } catch (error) {
      console.error('Failed to read local file:', error)
    }
  }

  private playbackStartTime: number = 0
  private playbackStartPlayheadTime: number = 0

  public setPlaybackSync(
    startTime: number,
    startPlayheadFrame: number,
    framerate: number,
  ) {
    this.playbackStartTime = startTime
    this.playbackStartPlayheadTime = startPlayheadFrame / framerate
  }

  private scheduleAudioData(audioData: AudioData) {
    const buffer = this.audioCtx.createBuffer(
      audioData.numberOfChannels,
      audioData.numberOfFrames,
      audioData.sampleRate,
    )

    for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
      const channelData = new Float32Array(audioData.numberOfFrames)
      audioData.copyTo(channelData, { planeIndex: channel })
      buffer.copyToChannel(channelData, channel)
    }

    const source = this.audioCtx.createBufferSource()
    source.buffer = buffer

    const gainNode = this.audioCtx.createGain()
    gainNode.gain.value = 1.0

    source.connect(gainNode)
    gainNode.connect(this.audioCtx.destination)

    // Track the source so we can stop it on pause
    this.activeSources.push(source)
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source)
    }

    // Calculate playTime relative to when we started "Play"
    const audioTimeInFile = audioData.timestamp / 1_000_000
    const playTime =
      this.playbackStartTime +
      (audioTimeInFile - this.playbackStartPlayheadTime)

    // Only start if it's in the future or very recent past
    if (playTime >= this.audioCtx.currentTime) {
      source.start(playTime)
    } else if (playTime > this.audioCtx.currentTime - 0.1) {
      // If it's slightly in the past (due to decoding latency), we can try to start with an offset
      const offset = this.audioCtx.currentTime - playTime
      source.start(this.audioCtx.currentTime, offset)
    }

    audioData.close()
  }
}
