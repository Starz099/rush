import type {
  AudioMetadata,
  AudioSample,
  IAudioProvider,
} from './providers/types'

export class AudioPipeline {
  private provider: IAudioProvider
  private audioCtx: AudioContext
  private decoder: AudioDecoder
  private currentSampleIndex: number = 0
  private activeSources: AudioBufferSourceNode[] = []
  private playbackStartTime: number = 0
  private playbackStartPlayheadTime: number = 0
  private decoderConfigured: boolean = false
  private disposed: boolean = false

  constructor(provider: IAudioProvider, audioCtx: AudioContext) {
    this.provider = provider
    this.audioCtx = audioCtx
    this.decoder = new AudioDecoder({
      output: (data) => this.scheduleAudioData(data),
      error: (e) => console.error('Audio pipeline Decoder error:', e),
    })
  }

  public decodeNextBatch(count: number = 5) {
    if (this.disposed || this.decoder.state === 'closed') return

    const remainingSamples =
      this.provider.getSampleCount() - this.currentSampleIndex
    const actualCount = Math.min(count, remainingSamples)

    for (let i = 0; i < actualCount; i++) {
      this.decodeAtIndex(this.currentSampleIndex)
      this.currentSampleIndex++
    }
  }

  private decodeAtIndex(index: number) {
    if (this.disposed) return

    const sample: AudioSample | null = this.provider.getSample(index)
    if (!sample) return

    const meta: AudioMetadata = this.provider.getMetadata()

    if (!this.decoderConfigured) {
      this.decoder.configure({
        codec: meta.codec,
        sampleRate: meta.sampleRate,
        numberOfChannels: meta.channels,
        description: meta.description,
      })
      this.decoderConfigured = true
    }

    const chunk = new EncodedAudioChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1e6) / meta.timescale,
      duration: (sample.duration * 1e6) / meta.timescale,
      data: sample.data,
    })

    this.decoder.decode(chunk)
  }

  private scheduleAudioData(data: AudioData) {
    if (this.disposed) {
      data.close()
      return
    }

    const buffer = this.audioCtx.createBuffer(
      data.numberOfChannels,
      data.numberOfFrames,
      data.sampleRate,
    )

    // Copy decoded PCM data into the AudioBuffer
    for (let ch = 0; ch < data.numberOfChannels; ch++) {
      const channelData = new Float32Array(data.numberOfFrames)
      data.copyTo(channelData, { planeIndex: ch })
      buffer.copyToChannel(channelData, ch)
    }

    const source = this.audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioCtx.destination)

    const audioTimeInSeconds = data.timestamp / 1e6
    const playtime =
      this.playbackStartTime +
      (audioTimeInSeconds - this.playbackStartPlayheadTime)

    // Track source so we can stop it if the user pauses
    this.activeSources.push(source)
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source)
    }

    // Only start if it's in the future or very recent past
    if (playtime >= this.audioCtx.currentTime) {
      source.start(playtime)
    } else if (playtime > this.audioCtx.currentTime - 0.1) {
      const offset = this.audioCtx.currentTime - playtime
      source.start(this.audioCtx.currentTime, offset)
    }

    data.close()
  }

  public setPlaybackSync(startTime: number, startPlayheadTime: number) {
    this.playbackStartTime = startTime
    this.playbackStartPlayheadTime = startPlayheadTime
  }

  public stop() {
    this.activeSources.forEach((s) => {
      try {
        s.stop()
        s.disconnect()
      } catch (e) {
        // Source might already be stopped
      }
    })
    this.activeSources = []
  }

  public seek(timeInSeconds: number) {
    if (this.disposed) return

    this.stop()
    this.decoder.reset()
    this.decoderConfigured = false

    this.currentSampleIndex = this.provider.findSampleIndex(timeInSeconds)
  }

  public dispose() {
    this.disposed = true
    this.stop()
    if (this.decoder.state !== 'closed') {
      this.decoder.close()
    }
  }
}
