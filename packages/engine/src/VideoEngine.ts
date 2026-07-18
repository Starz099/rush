import type { WebGPURenderer } from './core/Renderer';
import { LookAheadManager } from './buffering/LookAheadManager';
import type { Project, Clip, Asset, BackgroundConfig } from '@/api/bindings';

interface CachedTextCanvas {
  canvas: OffscreenCanvas;
  config: any;
  width: number;
  height: number;
}

export function drawTextToCanvas(canvas: OffscreenCanvas, clip: any) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const config = clip.effect_config || {};
    const text = config.text ?? 'Hello World';
    const fontSize = config.font_size ?? 24;
    const color = config.color ?? '#FFFFFF';
    const position = config.position || { x: 0.5, y: 0.5 };
    const fontFamily = config.font_family || 'Outfit, sans-serif';

    // Background properties
    const bgEnable = config.bg_enable ?? false;
    const bgColor = config.bg_color ?? '#000000';
    const bgOpacity = config.bg_opacity ?? 0.5;

    const x = position.x * canvas.width;
    const y = position.y * canvas.height;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px ${fontFamily}`;

    // 1. Draw dynamic background bounding box if enabled
    if (bgEnable) {
      const textMetrics = ctx.measureText(text);
      const paddingX = fontSize * 0.4;
      const paddingY = fontSize * 0.25;

      const boxWidth = textMetrics.width + paddingX * 2;
      const boxHeight = fontSize + paddingY * 2;

      ctx.save();
      ctx.globalAlpha = bgOpacity;
      ctx.fillStyle = bgColor;

      const rx = x - boxWidth / 2;
      const ry = y - boxHeight / 2;
      const radius = 6; // Slight rounded corners for premium aesthetics

      ctx.beginPath();
      // Draw rounded rectangle
      if (ctx.roundRect) {
        ctx.roundRect(rx, ry, boxWidth, boxHeight, radius);
      } else {
        ctx.rect(rx, ry, boxWidth, boxHeight);
      }
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw Text on top
    ctx.fillStyle = color;

    // Premium drop shadow (only if no background box is enabled)
    if (!bgEnable) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.fillText(text, x, y);
  }
}

export class VideoEngine {
  private renderer: WebGPURenderer;
  private lookAhead: LookAheadManager;
  private disposed = false;

  private textCanvasCache = new Map<string, CachedTextCanvas>();

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

    const width = (this.renderer as any).width || 1920;
    const height = (this.renderer as any).height || 1080;

    // Track text frames to close them safely after queue submission
    const tempFramesToClose: VideoFrame[] = [];

    // 1. Start WebGPU frame recording
    this.renderer.beginFrame(background);

    // 2. Render each active clip
    for (const clip of activeClips) {
      if (clip.effect_type === 'text') {
        const config = clip.effect_config || {};

        let canvas: OffscreenCanvas;
        const cached = this.textCanvasCache.get(clip.id);

        if (
          cached &&
          cached.config === config &&
          cached.width === width &&
          cached.height === height
        ) {
          canvas = cached.canvas;
        } else {
          canvas = new OffscreenCanvas(width, height);
          drawTextToCanvas(canvas, clip);
          this.textCanvasCache.set(clip.id, {
            canvas,
            config,
            width,
            height,
          });
        }

        const textFrame = new VideoFrame(canvas, { timestamp: 0 });
        tempFramesToClose.push(textFrame); // Store for cleanup

        const zIndex = config.z_index ?? 0;

        this.renderer.drawClip(textFrame, {
          x: 0,
          y: 0,
          scale: globalZoom,
          z_index: zIndex,
        });
      } else {
        // Pull the decoded frame from the LookAheadManager
        const frame = this.lookAhead.getFrame(
          clip.id,
          playheadFrame,
          framerate,
        );

        if (frame) {
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

          this.renderer.drawClip(frame, modifiedTransform);
        }
      }
    }

    // 3. Submit WebGPU commands to the GPU (Wait for order submission)
    this.renderer.endFrame();

    // 4. Now safe to destroy/close frames!
    for (const frame of tempFramesToClose) {
      frame.close();
    }
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
    this.textCanvasCache.clear();
  }
}
