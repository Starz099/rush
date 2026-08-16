import type { WebGPURenderer } from './core/Renderer';
import { LookAheadManager } from './buffering/LookAheadManager';
import type { Project, Asset } from '@/api/bindings';
import { evaluateAnimatable } from './animation/evaluator';

export function evaluateTransform(
  clip: any | null | undefined,
  playheadFrame: number,
) {
  const transform = clip?.transform;
  if (!transform) {
    const adjustments = clip?.adjustments || {};
    return {
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 0,
      anchor_x: 0.5,
      anchor_y: 0.5,
      opacity: 1.0,
      z_index: 0,
      brightness: adjustments.brightness ?? 1.0,
      contrast: adjustments.contrast ?? 1.0,
      saturation: adjustments.saturation ?? 1.0,
      vignette: adjustments.vignette ?? 0.0,
      sepia: adjustments.sepia ?? 0.0,
      temperature: adjustments.temperature ?? 0.0,
      preset: adjustments.preset ?? 'none',
      tint: adjustments.tint ?? [1.0, 1.0, 1.0],
    };
  }

  const x = evaluateAnimatable(transform.x, playheadFrame, 0.0);
  const y = evaluateAnimatable(transform.y, playheadFrame, 0.0);
  const scale = evaluateAnimatable(transform.scale, playheadFrame, 1.0);
  const rotation = evaluateAnimatable(transform.rotation, playheadFrame, 0.0);
  const opacity = evaluateAnimatable(transform.opacity, playheadFrame, 1.0);
  const anchor_x = transform.anchor_x ?? 0.5;
  const anchor_y = transform.anchor_y ?? 0.5;

  const adjustments = clip.adjustments || {};
  const brightness = adjustments.brightness ?? 1.0;
  const contrast = adjustments.contrast ?? 1.0;
  const saturation = adjustments.saturation ?? 1.0;
  const vignette = adjustments.vignette ?? 0.0;
  const sepia = adjustments.sepia ?? 0.0;
  const temperature = adjustments.temperature ?? 0.0;
  const preset = adjustments.preset ?? 'none';
  const tint = adjustments.tint ?? [1.0, 1.0, 1.0];

  return {
    x,
    y,
    scale,
    rotation,
    anchor_x,
    anchor_y,
    opacity,
    z_index: transform.z_index ?? 0,
    brightness,
    contrast,
    saturation,
    vignette,
    sepia,
    temperature,
    preset,
    tint,
  };
}

export function applySingleClipTransitions(
  transform: any,
  clip: any,
  playheadFrame: number,
): any {
  let nextTransform = { ...transform };

  // 1. Entrance (In) Transition
  if (clip.clip_transitions?.in_transition) {
    const start = clip.timeline_in;
    const duration = clip.clip_transitions.in_transition.duration_frames;
    if (
      playheadFrame >= start &&
      playheadFrame < start + duration &&
      duration > 0
    ) {
      const t = Math.min(
        1.0,
        Math.max(0.0, (playheadFrame - start) / duration),
      );
      const type = clip.clip_transitions.in_transition.transition_type;
      const config = clip.clip_transitions.in_transition.config || {};

      if (type === 'fade') {
        nextTransform.opacity *= t;
      } else if (type === 'zoom') {
        nextTransform.scale *= t;
        nextTransform.opacity *= t;
      } else if (type === 'spin') {
        nextTransform.rotation += 360.0 * (1.0 - t);
        nextTransform.scale *= t;
        nextTransform.opacity *= t;
      } else if (type === 'slide') {
        const angle = ((config.angle_degrees ?? 180) * Math.PI) / 180.0;
        const offsetX = Math.cos(angle) * 1920 * (1.0 - t);
        const offsetY = Math.sin(angle) * 1080 * (1.0 - t);
        nextTransform.x += offsetX;
        nextTransform.y += offsetY;
      } else if (type === 'glitch') {
        // High frequency horizontal shake
        const shake = Math.sin(playheadFrame * 1.8) * 35.0 * (1.0 - t);
        nextTransform.x += shake;
        // Digital opacity flicker
        const flicker = Math.sin(playheadFrame * 4.0);
        if (flicker > 0.2) {
          nextTransform.opacity *= t;
        } else {
          nextTransform.opacity = 0.0;
        }
      }
    }
  }

  // 2. Exit (Out) Transition
  if (clip.clip_transitions?.out_transition) {
    const end = clip.timeline_out;
    const duration = clip.clip_transitions.out_transition.duration_frames;
    if (
      playheadFrame >= end - duration &&
      playheadFrame < end &&
      duration > 0
    ) {
      const t = Math.min(1.0, Math.max(0.0, (end - playheadFrame) / duration));
      const type = clip.clip_transitions.out_transition.transition_type;
      const config = clip.clip_transitions.out_transition.config || {};

      if (type === 'fade') {
        nextTransform.opacity *= t;
      } else if (type === 'zoom') {
        nextTransform.scale *= t;
        nextTransform.opacity *= t;
      } else if (type === 'spin') {
        nextTransform.rotation += 360.0 * (1.0 - t);
        nextTransform.scale *= t;
        nextTransform.opacity *= t;
      } else if (type === 'slide') {
        const angle = ((config.angle_degrees ?? 0) * Math.PI) / 180.0;
        const offsetX = Math.cos(angle) * 1920 * (1.0 - t);
        const offsetY = Math.sin(angle) * 1080 * (1.0 - t);
        nextTransform.x += offsetX;
        nextTransform.y += offsetY;
      } else if (type === 'glitch') {
        // High frequency horizontal shake
        const shake = Math.sin(playheadFrame * 1.8) * 35.0 * (1.0 - t);
        nextTransform.x += shake;
        // Digital opacity flicker
        const flicker = Math.sin(playheadFrame * 4.0);
        if (flicker > 0.2) {
          nextTransform.opacity *= t;
        } else {
          nextTransform.opacity = 0.0;
        }
      }
    }
  }

  return nextTransform;
}

export function applyZoomEffect(
  transform: any,
  zoomClip: any,
  _width: number,
  _height: number,
): any {
  if (!zoomClip) return transform;

  // Evaluate the zoom effect clip's transform values
  const zScale =
    typeof zoomClip.transform?.scale?.value === 'number'
      ? zoomClip.transform.scale.value
      : 1.0;

  return {
    ...transform,
    x: transform.x * zScale,
    y: transform.y * zScale,
    scale: transform.scale * zScale,
  };
}

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
    activeProject: Project,
    _globalZoom: number = 1.0,
  ) {
    if (this.disposed) return;

    const width = (this.renderer as any).width || 1920;
    const height = (this.renderer as any).height || 1080;
    const background = activeProject.timeline_state.background;
    const framerate = activeProject.framerate; // numerical rate (e.g. 30)

    // Track text frames to close them safely after queue submission
    const tempFramesToClose: VideoFrame[] = [];

    // 1. Start WebGPU frame recording
    this.renderer.beginFrame(background);

    // 2. Identify active tracks
    const tracks = activeProject.timeline_state.tracks || [];

    // Sort tracks to render backgrounds/videos first, then overlays/effects on top
    const sortedTracks = [...tracks].sort((a, b) => {
      if (a.track_type?.toLowerCase() === 'audio') return -1;
      if (b.track_type?.toLowerCase() === 'audio') return 1;
      if (a.track_type?.toLowerCase() === 'effects') return 1;
      if (b.track_type?.toLowerCase() === 'effects') return -1;
      return 0;
    });

    // Find active Zoom Effect clip (if any) on the effects track at this playhead
    const effectsTrack = tracks.find(
      (t) => t.track_type?.toLowerCase() === 'effects',
    );
    const activeZoomClip = effectsTrack?.clips.find(
      (clip: any) =>
        playheadFrame >= clip.timeline_in &&
        playheadFrame < clip.timeline_out &&
        clip.effect_type === 'zoom',
    );

    console.log(
      `[VideoEngine] renderFrame playhead=${playheadFrame} activeZoomClip=${activeZoomClip?.id} scale=${activeZoomClip?.transform?.scale?.value} anchorX=${activeZoomClip?.transform?.anchor_x} anchorY=${activeZoomClip?.transform?.anchor_y}`,
    );

    for (const track of sortedTracks) {
      if (track.track_type?.toLowerCase() === 'audio') continue;

      // Draw standard clips
      for (const clip of track.clips) {
        if (
          playheadFrame >= clip.timeline_in &&
          playheadFrame < clip.timeline_out
        ) {
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
            tempFramesToClose.push(textFrame);

            const evaluatedTextTransform = applyZoomEffect(
              applySingleClipTransitions(
                evaluateTransform(clip, playheadFrame),
                clip,
                playheadFrame,
              ),
              activeZoomClip,
              width,
              height,
            );
            this.renderer.drawClip(textFrame, evaluatedTextTransform as any);
          } else if (clip.asset_id) {
            const frame = this.lookAhead.getFrame(
              clip.id,
              playheadFrame,
              framerate,
            );
            if (frame) {
              const evaluatedTransform = applyZoomEffect(
                applySingleClipTransitions(
                  evaluateTransform(clip, playheadFrame),
                  clip,
                  playheadFrame,
                ),
                activeZoomClip,
                width,
                height,
              );
              this.renderer.drawClip(frame, evaluatedTransform as any);
            }
          }
        }
      }
    }

    // 3. Submit WebGPU commands to the GPU
    this.renderer.endFrame();

    // 4. safe to close frames
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
