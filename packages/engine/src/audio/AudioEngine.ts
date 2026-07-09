import { AudioPipeline } from '../decoders/AudioPipeline';
import type { IAudioProvider } from './providers/types';

/**
 * AudioEngine acts as the master orchestrator for all audio tracks in the project.
 * It manages multiple AudioPipelines and ensures they are synchronized.
 */
export class AudioEngine {
  private audioCtx: AudioContext;
  private pipelines: Map<string, AudioPipeline> = new Map();
  private playbackStartTime: number = 0;
  private playbackStartPlayheadTime: number = 0;
  private disposed: boolean = false;
  private speedClips: any[] = [];
  private framerate: number = 30;

  constructor(context: AudioContext) {
    this.audioCtx = context;
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
    timelineEnd: number = Infinity,
    sourceEnd: number = Infinity,
  ) {
    if (this.disposed) return;

    // Initialize the provider (demuxing/metadata)
    await provider.initialize();

    // Create a new pipeline for this track
    const pipeline = new AudioPipeline(provider, this.audioCtx);
    pipeline.updateProjectConfig(this.speedClips, this.framerate);

    // Setup the spatial position immediately
    pipeline.setClipPosition(
      timelineStart,
      sourceStart,
      timelineEnd,
      sourceEnd,
    );

    // Sync the master clock
    pipeline.setMasterSync(
      this.playbackStartTime,
      this.playbackStartPlayheadTime,
    );

    this.pipelines.set(trackId, pipeline);
    return pipeline;
  }

  /**
   * Removes and disposes of a track.
   */
  public removeTrack(trackId: string) {
    const pipeline = this.pipelines.get(trackId);
    if (pipeline) {
      pipeline.dispose();
      this.pipelines.delete(trackId);
    }
  }

  /**
   * Stops all active audio sources across all tracks.
   */
  public stop() {
    this.pipelines.forEach((pipeline) => {
      pipeline.stop();
    });
  }

  /**
   * Triggers decoding for all active pipelines.
   * Called by the main playback loop.
   */
  public decodeNextBatch(count: number = 5) {
    if (this.disposed) return;
    this.pipelines.forEach((pipeline) => {
      pipeline.decodeNextBatch(count);
    });
  }

  /**
   * Updates project configuration (speed factor clips, framerate) for all active pipelines.
   */
  public updateProjectConfig(speedClips: any[], framerate: number) {
    this.speedClips = speedClips;
    this.framerate = framerate;
    this.pipelines.forEach((pipeline) => {
      pipeline.updateProjectConfig(speedClips, framerate);
    });
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
    this.playbackStartTime = startTime;
    this.playbackStartPlayheadTime = startPlayheadFrame / framerate;

    this.pipelines.forEach((pipeline) => {
      pipeline.setMasterSync(
        this.playbackStartTime,
        this.playbackStartPlayheadTime,
      );
    });
  }

  /**
   * Seeks all tracks to a specific time.
   */
  public seekByTime(timelinePlayheadInSeconds: number) {
    if (this.disposed) return;

    // After seeking, we update the internal sync so Play continues correctly
    this.playbackStartTime = this.audioCtx.currentTime;
    this.playbackStartPlayheadTime = timelinePlayheadInSeconds;

    this.pipelines.forEach((pipeline) => {
      // Calculate the source playhead for this specific track
      // sourcePlayhead = timelinePlayhead - clipTimelineStart + clipSourceStart
      const sourcePlayhead =
        timelinePlayheadInSeconds -
        pipeline.timelineStartInSeconds +
        pipeline.sourceStartInSeconds;

      // Seek the pipeline to the calculated position (clamp to >= sourceStart)
      const seekTarget = Math.max(
        pipeline.sourceStartInSeconds,
        sourcePlayhead,
      );
      pipeline.seek(seekTarget);

      // Sync the master clock on the pipeline
      pipeline.setMasterSync(
        this.playbackStartTime,
        this.playbackStartPlayheadTime,
      );
    });
  }

  /**
   * Returns a specific track pipeline.
   */
  public getTrack(trackId: string): AudioPipeline | undefined {
    return this.pipelines.get(trackId);
  }

  /**
   * Shuts down the engine and all pipelines.
   */
  public dispose() {
    this.disposed = true;
    this.pipelines.forEach((pipeline) => {
      pipeline.dispose();
    });
    this.pipelines.clear();
  }
}
