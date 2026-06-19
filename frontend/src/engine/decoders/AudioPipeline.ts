import type {
  AudioMetadata,
  AudioSample,
  IAudioProvider,
} from '../audio/providers/types'

export class AudioPipeline {
  private provider: IAudioProvider
  private audioCtx: AudioContext
  private decoder: AudioDecoder
  private currentSampleIndex: number = 0
  private activeSources: AudioBufferSourceNode[] = []
  private playbackStartTime: number = 0
  private playbackStartPlayheadTime: number = 0
  public timelineStartInSeconds: number = 0
  public sourceStartInSeconds: number = 0
  public timelineEndInSeconds: number = Infinity
  public sourceEndInSeconds: number = Infinity
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

    // PREVENT BACKLOG: If we've already scheduled more than 500ms of audio,
    // don't decode more. This keeps the engine lean while avoiding silence.
    const lastSampleIndex = this.currentSampleIndex - 1
    if (lastSampleIndex >= 0) {
      const lastSample = this.provider.getSample(lastSampleIndex)
      if (lastSample) {
        const meta = this.provider.getMetadata()
        const audioTimeInSource = lastSample.cts / meta.timescale
        const timelinePos =
          this.timelineStartInSeconds +
          (audioTimeInSource - this.sourceStartInSeconds)
        const playtime =
          this.playbackStartTime +
          (timelinePos - this.playbackStartPlayheadTime)

        // If the last scheduled sample is more than 0.5s in the future, chill.
        if (playtime > this.audioCtx.currentTime + 0.5) {
          return
        }
      }
    }

    const remainingSamples =
      this.provider.getSampleCount() - this.currentSampleIndex
    const actualCount = Math.min(count, remainingSamples)

    for (let i = 0; i < actualCount; i++) {
      const sample = this.provider.getSample(this.currentSampleIndex)
      if (!sample) break

      const meta = this.provider.getMetadata()
      const audioTimeInSource = sample.cts / meta.timescale
      if (audioTimeInSource > this.sourceEndInSeconds) {
        break // Do not decode past the clip's source end boundary
      }

      this.decodeAtIndex(this.currentSampleIndex)
      this.currentSampleIndex++
    }
  }

  private decodeAtIndex(index: number) {
    if (this.disposed) return

    const sample: AudioSample | null = this.provider.getSample(index)
    if (!sample) return

    const meta: AudioMetadata = this.provider.getMetadata()

    if (meta.isEncoded) {
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
    } else {
      // For unencoded PCM data, we can directly create an AudioData object
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: meta.sampleRate,
        numberOfChannels: meta.channels,
        numberOfFrames: sample.duration, // duration is in frames for unencoded
        timestamp: (sample.cts * 1e6) / meta.timescale,
        data: sample.data,
      })

      this.scheduleAudioData(audioData)
    }
  }

  public scheduleAudioData(data: AudioData) {
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

    // THE MASTER TIMELINE FORMULA:
    // 1. How far is this sample from the start of the source file?
    const audioTimeInSource = data.timestamp / 1e6
    if (audioTimeInSource > this.sourceEndInSeconds) {
      data.close()
      return
    }

    // 2. Where should this sit on the project timeline?
    // TimelinePos = ClipTimelineStart + (AudioTimeInSource - ClipSourceStart)
    const timelinePos =
      this.timelineStartInSeconds +
      (audioTimeInSource - this.sourceStartInSeconds)
    if (timelinePos > this.timelineEndInSeconds) {
      data.close()
      return
    }

    // 3. When should this play on the hardware clock?
    // PlayTime = MasterStartTime + (TimelinePos - MasterStartPlayhead)
    const playtime =
      this.playbackStartTime + (timelinePos - this.playbackStartPlayheadTime)

    const clipEndTimeline = this.timelineEndInSeconds
    const clipEndPlaytime =
      this.playbackStartTime +
      (clipEndTimeline - this.playbackStartPlayheadTime)

    if (playtime >= clipEndPlaytime) {
      data.close()
      return
    }

    // Track source so we can stop it if the user pauses
    this.activeSources.push(source)
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source)
    }

    // Only start if it's in the future or very recent past
    const currentTime = this.audioCtx.currentTime
    // LOOK-AHEAD: We schedule slightly into the future to absorb main-thread jitter
    if (playtime >= currentTime) {
      source.start(playtime)
      source.stop(clipEndPlaytime)
    } else if (playtime > currentTime - 0.2) {
      // Increased tolerance for lag
      // If it's slightly in the past, start with an offset
      const offset = currentTime - playtime
      source.start(currentTime, offset)
      source.stop(clipEndPlaytime)
    }

    data.close()
  }

  /**
   * Updates the master clock synchronization point.
   * Called when the user hits Play or when the clock drifts.
   */
  public setMasterSync(startTime: number, startPlayheadTime: number) {
    this.playbackStartTime = startTime
    this.playbackStartPlayheadTime = startPlayheadTime
  }

  /**
   * Updates the clip's physical position on the project timeline.
   * Called by the Orchestrator when a clip is moved or resized.
   */
  public setClipPosition(
    timelineStart: number,
    sourceStart: number,
    timelineEnd: number = Infinity,
    sourceEnd: number = Infinity,
  ) {
    this.timelineStartInSeconds = timelineStart
    this.sourceStartInSeconds = sourceStart
    this.timelineEndInSeconds = timelineEnd
    this.sourceEndInSeconds = sourceEnd
  }

  /**
   * Legacy method for compatibility - now redirects to both sync types.
   */
  public setPlaybackSync(
    startTime: number,
    startPlayheadTime: number,
    timelineStart?: number,
    sourceStart?: number,
    timelineEnd?: number,
    sourceEnd?: number,
  ) {
    this.setMasterSync(startTime, startPlayheadTime)
    if (
      timelineStart !== undefined &&
      sourceStart !== undefined &&
      timelineEnd !== undefined &&
      sourceEnd !== undefined
    ) {
      this.setClipPosition(timelineStart, sourceStart, timelineEnd, sourceEnd)
    }
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

    const clampedTime = Math.max(this.sourceStartInSeconds, timeInSeconds)
    this.currentSampleIndex = this.provider.findSampleIndex(clampedTime)
  }

  public dispose() {
    this.disposed = true
    this.stop()
    if (this.decoder.state !== 'closed') {
      this.decoder.close()
    }
  }
}
