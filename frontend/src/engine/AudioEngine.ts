import { AudioPipeline } from './AudioPipeline'
import type { IAudioProvider } from './providers/types'

/**
 * AudioEngine acts as the master orchestrator for all audio tracks in the project.
 * It manages multiple AudioPipelines and ensures they are synchronized.
 */
export class AudioEngine {
  private audioCtx: AudioContext
  private pipelines: Map<string, AudioPipeline> = new Map()
  private playbackStartTime: number = 0
  private playbackStartPlayheadTime: number = 0
  private disposed: boolean = false

  constructor(context: AudioContext) {
    this.audioCtx = context
  }

  /**
   * Adds a new audio track to the engine.
   * @param trackId Unique identifier for the track (usually the Clip ID)
   * @param provider An implementation of IAudioProvider (MP4, Standalone, etc.)
   */
  public async addTrack(
    trackId: string,
    provider: IAudioProvider,
    timelineStart: number = 0,
    sourceStart: number = 0,
  ) {
    if (this.disposed) return

    // Initialize the provider (demuxing/metadata)
    await provider.initialize()

    // Create a new pipeline for this track
    const pipeline = new AudioPipeline(provider, this.audioCtx)

    // Setup the spatial position immediately
    pipeline.setClipPosition(timelineStart, sourceStart)

    // Sync the master clock
    pipeline.setMasterSync(
      this.playbackStartTime,
      this.playbackStartPlayheadTime,
    )

    this.pipelines.set(trackId, pipeline)
    return pipeline
  }

  /**
   * Removes and disposes of a track.
   */
  public removeTrack(trackId: string) {
    const pipeline = this.pipelines.get(trackId)
    if (pipeline) {
      pipeline.dispose()
      this.pipelines.delete(trackId)
    }
  }

  /**
   * Stops all active audio sources across all tracks.
   */
  public stop() {
    this.pipelines.forEach((pipeline) => {
      pipeline.stop()
    })
  }

  /**
   * Triggers decoding for all active pipelines.
   * Called by the main playback loop.
   */
  public decodeNextBatch(count: number = 5) {
    if (this.disposed) return
    this.pipelines.forEach((pipeline) => {
      pipeline.decodeNextBatch(count)
    })
  }

  /**
   * Sets the master synchronization point for all tracks.
   * This updates the master clock without affecting individual clip positions.
   */
  public setPlaybackSync(
    startTime: number,
    startPlayheadFrame: number,
    framerate: number,
  ) {
    this.playbackStartTime = startTime
    this.playbackStartPlayheadTime = startPlayheadFrame / framerate

    this.pipelines.forEach((pipeline) => {
      pipeline.setMasterSync(
        this.playbackStartTime,
        this.playbackStartPlayheadTime,
      )
    })
  }

  /**
   * Seeks all tracks to a specific time.
   */
  public seekByTime(
    timeInSeconds: number,
    timelineStart: number = 0,
    sourceStart: number = 0,
  ) {
    if (this.disposed) return
    this.pipelines.forEach((pipeline) => {
      pipeline.seek(timeInSeconds)
    })

    // After seeking, we update the internal sync so Play continues correctly
    this.playbackStartTime = this.audioCtx.currentTime
    this.playbackStartPlayheadTime = timeInSeconds

    this.pipelines.forEach((pipeline) => {
      pipeline.setPlaybackSync(
        this.playbackStartTime,
        this.playbackStartPlayheadTime,
        timelineStart,
        sourceStart,
      )
    })
  }

  /**
   * Returns a specific track pipeline.
   */
  public getTrack(trackId: string): AudioPipeline | undefined {
    return this.pipelines.get(trackId)
  }

  /**
   * Shuts down the engine and all pipelines.
   */
  public dispose() {
    this.disposed = true
    this.pipelines.forEach((pipeline) => {
      pipeline.dispose()
    })
    this.pipelines.clear()
  }
}
