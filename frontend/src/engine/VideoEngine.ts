import type { WebGPURenderer } from './core/Renderer';
import { LookAheadManager } from './buffering/LookAheadManager';
import type { Project, Clip, Asset, BackgroundConfig } from '@/api/bindings';

export class VideoEngine {
  private renderer: WebGPURenderer;
  private lookAhead: LookAheadManager;
  private disposed = false;

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;
    this.lookAhead = new LookAheadManager();
  }

  /**
   * Logical tick called by the playback loop to manage prefetching and background decoding.
   */
  public async tick(
    playheadFrame: number,
    activeProject: Project,
    assets: Asset[],
  ) {
    if (this.disposed) return;
    await this.lookAhead.tick(playheadFrame, activeProject, assets);
  }

  /**
   * Render tick called by the playback loop to draw all active frames on screen.
   */
  public renderFrame(
    playheadFrame: number,
    activeClips: Clip[],
    framerate: number,
    background?: BackgroundConfig | null,
    globalZoom: number = 1.0,
  ) {
    if (this.disposed) return;

    // 1. Start WebGPU frame recording
    this.renderer.beginFrame(background);

    // 2. Render each active clip
    for (const clip of activeClips) {
      // Pull the decoded frame from the LookAheadManager
      const frame = this.lookAhead.getFrame(clip.id, playheadFrame, framerate);

      if (frame) {
        // Adjust the individual clip transform by the global zoom multiplier
        const originalTransform = clip.transform;
        const modifiedTransform = originalTransform
          ? {
              x: (originalTransform.x ?? 0) * globalZoom,
              y: (originalTransform.y ?? 0) * globalZoom,
              scale: (originalTransform.scale ?? 1.0) * globalZoom,
              z_index: originalTransform.z_index,
            }
          : {
              x: 0,
              y: 0,
              scale: globalZoom,
              z_index: 0,
            };

        // Draw the frame onto the canvas using our WebGPU renderer
        this.renderer.drawClip(frame, modifiedTransform);
      }
    }

    // 3. Submit WebGPU commands to the GPU
    this.renderer.endFrame();
  }

  /**
   * Resets all buffer sessions. Called when playhead jumps/scrubs.
   */
  public reset() {
    this.lookAhead.reset();
  }

  /**
   * Clean up everything when disposing the editor
   */
  public dispose() {
    this.disposed = true;
    this.lookAhead.dispose();
  }
}
