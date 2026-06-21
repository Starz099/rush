import { WebGPURenderer } from '../core/Renderer';
import { LookAheadManager } from '../buffering/LookAheadManager';
import type { Project, Clip, Asset } from '@/api/bindings';
import { fpsToNumeric } from '../../helpers/fps';
import { isVideoTrack } from '@/constants/trackConfig';
import { invoke } from '@tauri-apps/api/core';

export class ExportEngine {
  private renderer: WebGPURenderer;
  private lookAhead: LookAheadManager;
  private width: number;
  private height: number;
  public disposed = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // Instantiate a separate renderer in Offscreen/Headless mode
    this.renderer = new WebGPURenderer({ width, height });
    this.lookAhead = new LookAheadManager();
  }

  public async initialize() {
    await this.renderer.initialize();
  }

  /**
   * Block and poll until the LookAheadManager has decoded the frame for a specific clip at the playhead frame.
   */
  private async awaitFrameDecoded(
    clip: Clip,
    playheadFrame: number,
    framerate: number,
    activeProject: Project,
    assets: Asset[],
  ): Promise<void> {
    const session = (this.lookAhead as any).sessions.get(clip.id) as any;
    if (!session) {
      console.warn(`[ExportEngine] No session found for clip ${clip.id}`);
      return;
    }

    const clipInSec = clip.timeline_in / framerate;
    const playheadSeconds = playheadFrame / framerate;
    const sourcePlayheadSeconds =
      playheadSeconds - clipInSec + clip.source_in / framerate;
    const sourcePlayheadMicroseconds = Math.round(sourcePlayheadSeconds * 1e6);

    console.log(
      `[ExportEngine] Awaiting decode for clip=${clip.id} sourceTime=${sourcePlayheadSeconds.toFixed(3)}s (target ts=${sourcePlayheadMicroseconds}us)`,
    );

    const startTime = performance.now();
    const timeoutMs = 5000; // 5-second timeout limit

    while (performance.now() - startTime < timeoutMs) {
      // Check if already cached in session
      if (
        session.currentFrame &&
        Math.abs(session.currentFrame.timestamp - sourcePlayheadMicroseconds) <
          33000
      ) {
        return;
      }
      // Check if present in FrameQueue
      if (session.queue.hasDecodedFrame(sourcePlayheadMicroseconds)) {
        return;
      }

      // Re-trigger look-ahead manager tick to push decoding
      await this.lookAhead.tick(playheadFrame, activeProject, assets);
      // Wait for the browser thread (WebCodecs decoder callback) to process (using 1ms poll for high-speed exports)
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    console.warn(
      `[ExportEngine] Timeout waiting for clip ${clip.id} to decode at frame ${playheadFrame}`,
    );
  }

  /**
   * Capture offscreen frame pixels as a raw Uint8Array (RGBA/BGRA format).
   * Handles WebGPU 256-byte row alignment mapping rules seamlessly.
   */
  public async captureFrameData(): Promise<Uint8Array> {
    const device = (this.renderer as any).device as GPUDevice;
    const offscreenTexture = (this.renderer as any)
      .offscreenTexture as GPUTexture;

    if (!device || !offscreenTexture) {
      throw new Error('ExportEngine is not initialized properly.');
    }

    const bytesPerPixel = 4;
    const unpaddedBytesPerRow = this.width * bytesPerPixel;
    const align = 256;
    const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align;
    const bufferSize = paddedBytesPerRow * this.height;

    // 1. Create a staging buffer mapped for reading
    const stagingBuffer = device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // 2. Command GPU to copy texture to buffer
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
      { texture: offscreenTexture },
      { buffer: stagingBuffer, bytesPerRow: paddedBytesPerRow },
      { width: this.width, height: this.height, depthOrArrayLayers: 1 },
    );
    device.queue.submit([commandEncoder.finish()]);

    // 3. Map buffer to CPU memory space
    await stagingBuffer.mapAsync(GPUMapMode.READ);

    // 4. Read data and unpad row-by-row
    const rawRange = stagingBuffer.getMappedRange();
    const sourceBytes = new Uint8Array(rawRange);
    const destBytes = new Uint8Array(this.width * this.height * bytesPerPixel);

    for (let y = 0; y < this.height; y++) {
      const sourceOffset = y * paddedBytesPerRow;
      const destOffset = y * unpaddedBytesPerRow;
      destBytes.set(
        sourceBytes.subarray(sourceOffset, sourceOffset + unpaddedBytesPerRow),
        destOffset,
      );
    }

    // 5. Cleanup
    stagingBuffer.unmap();
    stagingBuffer.destroy();

    return destBytes;
  }

  /**
   * Run a test render & capture of a single frame at the given playhead position.
   */
  public async testExportSingleFrame(
    playheadFrame: number,
    activeProject: Project,
    assets: Asset[],
    globalZoom: number = 1.0,
  ): Promise<Uint8Array> {
    const timeline = activeProject.timeline_state;
    const framerate = fpsToNumeric(activeProject.framerate);
    const background = timeline.background;

    // Resolve global zoom scale factor from the timeline effects track
    const effectsTracks = timeline.tracks.filter(
      (t: any) => t.track_type?.toLowerCase() === 'effects',
    );
    const activeZoomClip = effectsTracks
      .flatMap((t: any) => t.clips)
      .find(
        (clip: any) =>
          clip.transform?.scale !== undefined &&
          clip.transform?.scale !== null &&
          playheadFrame >= clip.timeline_in &&
          playheadFrame < clip.timeline_out,
      );
    const activeZoom = activeZoomClip?.transform?.scale ?? 1.0;
    const resolvedZoom = globalZoom !== 1.0 ? globalZoom : activeZoom;

    console.log(
      `[ExportEngine] Resolved Zoom Scale: ${resolvedZoom}x. Pre-buffering assets for frame ${playheadFrame}...`,
    );
    // Pre-decodes upcoming frames (tick lookahead manager)
    await this.lookAhead.tick(playheadFrame, activeProject, assets);

    // Identify active video clips at this frame
    const videoTracks = timeline.tracks.filter(isVideoTrack);
    const activeClipsToRender: Clip[] = [];

    videoTracks.forEach((track: any) => {
      const activeClips = track.clips.filter(
        (clip: any) =>
          playheadFrame >= clip.timeline_in &&
          playheadFrame < clip.timeline_out,
      );
      activeClipsToRender.push(...activeClips);
    });

    // Sort by z-index
    activeClipsToRender.sort(
      (a, b) => (a.transform?.z_index || 0) - (b.transform?.z_index || 0),
    );

    // Synchronously block until all active frames are decoded into the session queues
    for (const clip of activeClipsToRender) {
      await this.awaitFrameDecoded(
        clip,
        playheadFrame,
        framerate,
        activeProject,
        assets,
      );
    }

    console.log(`[ExportEngine] Rendering frame ${playheadFrame} offscreen...`);

    // Render
    this.renderer.beginFrame(background);
    for (const clip of activeClipsToRender) {
      const frame = this.lookAhead.getFrame(clip.id, playheadFrame, framerate);
      if (frame) {
        const originalTransform = clip.transform;
        const modifiedTransform = originalTransform
          ? {
              x: (originalTransform.x ?? 0) * resolvedZoom,
              y: (originalTransform.y ?? 0) * resolvedZoom,
              scale: (originalTransform.scale ?? 1.0) * resolvedZoom,
              z_index: originalTransform.z_index,
            }
          : {
              x: 0,
              y: 0,
              scale: resolvedZoom,
              z_index: 0,
            };

        this.renderer.drawClip(frame, modifiedTransform);
      }
    }
    this.renderer.endFrame();

    console.log(`[ExportEngine] Copying offscreen frame to staging buffer...`);
    const frameData = await this.captureFrameData();

    console.log('Piping raw frame bytes across the binary bridge...');

    // Pass dimensions and format via headers to keep IPC payload un-serialized
    //@ts-ignore
    await invoke('save_test_frame', frameData, {
      headers: {
        'x-width': this.width.toString(),
        'x-height': this.height.toString(),
        'x-format': (this.renderer as any).format || 'bgra8unorm',
      },
    });

    console.log('Backend successfully processed and saved the frame.');
    console.log(
      `[ExportEngine] Success! Extracted ${frameData.byteLength} bytes.`,
    );

    return frameData;
  }

  public dispose() {
    this.disposed = true;
    this.renderer.dispose();
    this.lookAhead.dispose();
  }

  /**
   * Runs through the timeline frame-by-frame, decodes, renders offscreen, and streams to the backend.
   * Backpressure is natively managed by awaiting the GPU buffer read and the Tauri IPC call sequentially.
   */
  public async exportTimeline(
    activeProject: Project,
    assets: Asset[],
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const timeline = activeProject.timeline_state;
    const framerate = fpsToNumeric(activeProject.framerate);
    const background = timeline.background;

    // 1. Resolve global zoom scale factor from the timeline effects track
    const effectsTracks = timeline.tracks.filter(
      (t: any) => t.track_type?.toLowerCase() === 'effects',
    );
    const activeZoomClip = effectsTracks
      .flatMap((t: any) => t.clips)
      .find(
        (clip: any) =>
          clip.transform?.scale !== undefined && clip.transform?.scale !== null,
      );
    const resolvedZoom = activeZoomClip?.transform?.scale ?? 1.0;

    // 2. Find total duration in frames
    const allClips = timeline.tracks.flatMap((track: any) => track.clips);
    const totalFrames = allClips.reduce(
      (max: number, clip: any) => Math.max(max, clip.timeline_out),
      0,
    );

    console.log(
      `[ExportEngine] Starting export. Total frames to render: ${totalFrames}`,
    );

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (this.disposed) {
        console.log(
          '[ExportEngine] Export loop terminated because engine was disposed.',
        );
        break;
      }

      const timestampMicros = Math.round((frameIndex / framerate) * 1e6);

      // Pre-decodes upcoming frames (tick lookahead manager)
      await this.lookAhead.tick(frameIndex, activeProject, assets);

      // Identify active video clips at this frame
      const videoTracks = timeline.tracks.filter(isVideoTrack);
      const activeClipsToRender: Clip[] = [];

      videoTracks.forEach((track: any) => {
        const activeClips = track.clips.filter(
          (clip: any) =>
            frameIndex >= clip.timeline_in && frameIndex < clip.timeline_out,
        );
        activeClipsToRender.push(...activeClips);
      });

      // Sort by z-index
      activeClipsToRender.sort(
        (a, b) => (a.transform?.z_index || 0) - (b.transform?.z_index || 0),
      );

      // Synchronously block until all active frames are decoded into the session queues
      for (const clip of activeClipsToRender) {
        await this.awaitFrameDecoded(
          clip,
          frameIndex,
          framerate,
          activeProject,
          assets,
        );
      }

      // 3. Render offscreen
      this.renderer.beginFrame(background);
      for (const clip of activeClipsToRender) {
        const frame = this.lookAhead.getFrame(clip.id, frameIndex, framerate);
        if (frame) {
          const originalTransform = clip.transform;
          const modifiedTransform = originalTransform
            ? {
                x: (originalTransform.x ?? 0) * resolvedZoom,
                y: (originalTransform.y ?? 0) * resolvedZoom,
                scale: (originalTransform.scale ?? 1.0) * resolvedZoom,
                z_index: originalTransform.z_index,
              }
            : {
                x: 0,
                y: 0,
                scale: resolvedZoom,
                z_index: 0,
              };

          this.renderer.drawClip(frame, modifiedTransform);
        }
      }
      this.renderer.endFrame();

      // 4. Extract resolved pixel bytes using GPU mapping (handles 256-byte alignment rules)
      const frameData = await this.captureFrameData();

      // 5. Stream frame bytes and metadata via headers to Tauri
      await invoke('stream_export_frame', frameData, {
        headers: {
          'x-frame-index': frameIndex.toString(),
          'x-timestamp-micros': timestampMicros.toString(),
          'x-width': this.width.toString(),
          'x-height': this.height.toString(),
        },
      });

      // 6. Update progress indicator
      if (onProgress) {
        onProgress((frameIndex + 1) / totalFrames);
      }
    }

    console.log('[ExportEngine] Export loop finished.');
  }
}
