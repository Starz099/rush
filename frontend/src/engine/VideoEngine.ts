import { VideoDemuxer } from './Demuxer'
import type { WebGPURenderer } from './Renderer'

/**
 * VideoEngine acts as the master registry for all video clips in the project.
 * It manages multiple VideoDemuxers concurrently, sharing a single WebGPURenderer.
 */
export class VideoEngine {
  private renderer: WebGPURenderer
  private demuxers: Map<string, VideoDemuxer> = new Map()
  private disposed: boolean = false

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer
  }

  /**
   * Clears the canvas. Should be called at the start of every frame/tick.
   */
  public clear() {
    this.renderer.clear()
  }

  /**
   * Adds and initializes a new video clip.
   * @param clipId Unique identifier for the clip.
   * @param filePath Path to the video file.
   */
  public async addClip(clipId: string, filePath: string) {
    if (this.disposed || this.demuxers.has(clipId)) return

    const demuxer = new VideoDemuxer(filePath, this.renderer)

    // Initialize (fetch metadata, start demuxing)
    await demuxer.initialize()

    this.demuxers.set(clipId, demuxer)
    console.log(`[VideoEngine] Added clip: ${clipId}`)
    return demuxer
  }

  /**
   * Removes and disposes of a clip.
   */
  public removeClip(clipId: string) {
    const demuxer = this.demuxers.get(clipId)
    if (demuxer) {
      demuxer.dispose()
      this.demuxers.delete(clipId)
      console.log(`[VideoEngine] Removed clip: ${clipId}`)
    }
  }

  /**
   * Returns a specific demuxer instance.
   */
  public getClip(clipId: string): VideoDemuxer | undefined {
    return this.demuxers.get(clipId)
  }

  /**
   * Seeks a specific clip to a time.
   */
  public async seekByTime(clipId: string, timeInSeconds: number) {
    const demuxer = this.demuxers.get(clipId)
    if (demuxer) {
      await demuxer.seekByTime(timeInSeconds)
    }
  }

  /**
   * Decodes and renders a frame for a specific clip at a time.
   */
  public async displayAtTime(clipId: string, timeInSeconds: number) {
    const demuxer = this.demuxers.get(clipId)
    if (demuxer) {
      await demuxer.displayAtTime(timeInSeconds)
    }
  }

  /**
   * Shuts down the engine and all demuxers.
   */
  public dispose() {
    this.disposed = true
    this.demuxers.forEach((demuxer) => {
      demuxer.dispose()
    })
    this.demuxers.clear()
  }
}
