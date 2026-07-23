import { WebGPURenderer } from '../core/Renderer';
import { LookAheadManager } from '../buffering/LookAheadManager';
import type { Project, Clip, Asset } from '@/api/bindings';
import type { ExportPhase } from '@/types/export';
import { fpsToNumeric } from '../helpers/fps';
import { isVideoTrack } from '../helpers/track';
import { exportApi } from '@/api/export';
import { avcToAnnexB } from './avcToAnnexB';
import { exportAudioChunk, clearAudioExportCache } from './audioExportHelper';
import {
  AUDIO_CHUNK_SIZE_SECONDS,
  EXPORT_VIDEO_BITRATE,
} from '../constants/export';
import { getZIndex } from '../helpers/clip';
import {
  drawTextToCanvas,
  evaluateTransform,
  applySingleClipTransitions,
} from '../VideoEngine';
import { generateStoryboardImpl } from '../storyboard/StoryboardGenerator';
const yieldToMainThread = () =>
  new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve(null);
    channel.port2.postMessage(null);
  });

export class ExportEngine {
  private renderer: WebGPURenderer;
  private lookAhead: LookAheadManager;
  private width: number;
  private height: number;
  public disposed = false;
  private encoder!: VideoEncoder;
  private pendingChunks: Promise<any>[] = [];

  private textCanvasCache = new Map<
    string,
    { canvas: OffscreenCanvas; config: any; width: number; height: number }
  >();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // Instantiate an OffscreenCanvas to render WebGPU directly into it
    const canvas = new OffscreenCanvas(width, height);
    this.renderer = new WebGPURenderer(canvas);
    this.lookAhead = new LookAheadManager();
  }

  private async initVideoEncoder(framerate: number) {
    this.pendingChunks = [];

    // H.264 Level 4.2/4.0 profiles are required for 1080p 60fps limits.
    const codecs = ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42001e'];
    let selectedCodec = 'avc1.42001e';

    for (const codec of codecs) {
      try {
        const config = {
          codec,
          width: this.width % 2 === 0 ? this.width : this.width - 1,
          height: this.height % 2 === 0 ? this.height : this.height - 1,
          bitrate: EXPORT_VIDEO_BITRATE,
          framerate,
        };
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          selectedCodec = codec;
          console.log(`[VideoEncoder] Selected supported codec: ${codec}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const chunkData = new Uint8Array(chunk.byteLength);
        chunk.copyTo(chunkData);

        const annexBBuffer = avcToAnnexB(
          chunkData,
          chunk.type === 'key',
          metadata,
        );

        // Stream compressed H.264 raw packet directly to Tauri backend
        const p = exportApi.writeVideoChunk(annexBBuffer);
        this.pendingChunks.push(p);
      },
      error: (error) => {
        console.error('[VideoEncoder] Encoding error:', error);
      },
    });

    this.encoder.configure({
      codec: selectedCodec,
      width: this.width % 2 === 0 ? this.width : this.width - 1,
      height: this.height % 2 === 0 ? this.height : this.height - 1,
      bitrate: EXPORT_VIDEO_BITRATE,
      framerate: framerate,
      hardwareAcceleration: 'no-preference', // Automatically use GPU but fallback gracefully to software if needed
    });
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
    const context = (this.renderer as any).context as GPUCanvasContext;
    const offscreenTexture = (this.renderer as any)
      .offscreenTexture as GPUTexture;

    const sourceTexture = context
      ? context.getCurrentTexture()
      : offscreenTexture;

    if (!device || !sourceTexture) {
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
      { texture: sourceTexture },
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
          clip.effect_type === 'zoom' &&
          playheadFrame >= clip.timeline_in &&
          playheadFrame < clip.timeline_out,
      );
    const activeZoom = activeZoomClip?.effect_config?.scale ?? 1.0;

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
          clip.asset_id &&
          playheadFrame >= clip.timeline_in &&
          playheadFrame < clip.timeline_out,
      );
      activeClipsToRender.push(...activeClips);
    });

    effectsTracks.forEach((track: any) => {
      const activeClips = track.clips.filter(
        (clip: any) =>
          clip.effect_type === 'text' &&
          playheadFrame >= clip.timeline_in &&
          playheadFrame < clip.timeline_out,
      );
      activeClipsToRender.push(...activeClips);
    });

    // Sort by z-index
    activeClipsToRender.sort((a, b) => getZIndex(a) - getZIndex(b));

    // Synchronously block until all active frames are decoded into the session queues
    for (const clip of activeClipsToRender) {
      if (clip.effect_type !== 'text') {
        await this.awaitFrameDecoded(
          clip,
          playheadFrame,
          framerate,
          activeProject,
          assets,
        );
      }
    }

    console.log(`[ExportEngine] Rendering frame ${playheadFrame} offscreen...`);

    // Render
    const tempFramesToClose: VideoFrame[] = [];

    this.renderer.beginFrame(background);
    for (const clip of activeClipsToRender) {
      if (clip.effect_type === 'text') {
        const config = clip.effect_config || {};

        let canvas: OffscreenCanvas;
        const cached = this.textCanvasCache.get(clip.id);

        if (
          cached &&
          cached.config === config &&
          cached.width === this.width &&
          cached.height === this.height
        ) {
          canvas = cached.canvas;
        } else {
          canvas = new OffscreenCanvas(this.width, this.height);
          drawTextToCanvas(canvas, clip);
          this.textCanvasCache.set(clip.id, {
            canvas,
            config,
            width: this.width,
            height: this.height,
          });
        }

        const textFrame = new VideoFrame(canvas, { timestamp: 0 });
        tempFramesToClose.push(textFrame);
        const evaluatedTransform = applySingleClipTransitions(
          evaluateTransform(clip.transform, playheadFrame, resolvedZoom),
          clip,
          playheadFrame,
        );
        this.renderer.drawClip(textFrame, evaluatedTransform as any);
      } else {
        const frame = this.lookAhead.getFrame(
          clip.id,
          playheadFrame,
          framerate,
        );
        if (frame) {
          const evaluatedTransform = applySingleClipTransitions(
            evaluateTransform(clip.transform, playheadFrame, resolvedZoom),
            clip,
            playheadFrame,
          );
          this.renderer.drawClip(frame, evaluatedTransform as any);
        }
      }
    }
    this.renderer.endFrame();

    for (const frame of tempFramesToClose) {
      frame.close();
    }

    console.log(`[ExportEngine] Copying offscreen frame to staging buffer...`);
    const frameData = await this.captureFrameData();

    console.log('Piping raw frame bytes across the binary bridge...');

    // Pass dimensions and format via headers to keep IPC payload un-serialized
    await exportApi.saveTestFrame(
      frameData,
      this.width,
      this.height,
      (this.renderer as any).format || 'bgra8unorm',
    );

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
    if (this.encoder && this.encoder.state !== 'closed') {
      this.encoder.close();
    }
  }

  /**
   * Runs through the timeline frame-by-frame, decodes, renders offscreen, and streams to the backend.
   * Backpressure is natively managed by awaiting the GPU buffer read and the Tauri IPC call sequentially.
   */
  public async exportTimeline(
    activeProject: Project,
    assets: Asset[],
    outputPath: string,
    extractedAudios: Record<string, string>,
    onProgress?: (progress: number) => void,
    onPhaseChange?: (phase: ExportPhase) => void,
  ): Promise<void> {
    if (onPhaseChange) onPhaseChange('preparing');
    clearAudioExportCache();
    const timeline = activeProject.timeline_state;
    const framerate = fpsToNumeric(activeProject.framerate);
    const background = timeline.background;

    // 1. Filter effects tracks once before starting the loop
    const effectsTracks = timeline.tracks.filter(
      (t: any) => t.track_type?.toLowerCase() === 'effects',
    );

    const speedClips = effectsTracks
      .flatMap((t: any) => t.clips)
      .filter(
        (clip: any) =>
          clip.speed_factor !== undefined && clip.speed_factor !== null,
      );

    // 2. Find total duration in frames based only on video tracks by default
    const videoTracks = timeline.tracks.filter(isVideoTrack);
    const allVideoClips = videoTracks.flatMap((track: any) => track.clips);
    let totalFrames = allVideoClips.reduce(
      (max: number, clip: any) => Math.max(max, clip.timeline_out),
      0,
    );

    // Fallback to all media tracks if there are no video tracks
    if (totalFrames === 0) {
      const mediaTracks = timeline.tracks.filter(
        (t: any) => t.track_type?.toLowerCase() !== 'effects',
      );
      const allMediaClips = mediaTracks.flatMap((track: any) => track.clips);
      totalFrames = allMediaClips.reduce(
        (max: number, clip: any) => Math.max(max, clip.timeline_out),
        0,
      );
    }

    console.log(
      `[ExportEngine] Starting export to: ${outputPath}. Total frames: ${totalFrames} (derived from active media tracks)`,
    );

    // Collect speed blocks to send to the backend
    const speedBlocks = speedClips.map((clip: any) => ({
      start_frame: clip.timeline_in,
      end_frame: clip.timeline_out,
      factor: clip.speed_factor,
    }));

    // Initialize the backend WebCodecs export session
    await exportApi.start(
      this.width,
      this.height,
      framerate,
      outputPath,
      speedBlocks,
    );

    // Initialize the frontend video encoder
    await this.initVideoEncoder(framerate);

    if (onPhaseChange) onPhaseChange('video');

    try {
      let timelinePlayhead = 0;
      let outputFrameIndex = 0;

      while (timelinePlayhead < totalFrames) {
        if (this.disposed) {
          throw new Error('cancelled');
        }

        const currentTimelineFrame = Math.floor(timelinePlayhead);

        // Pre-decodes upcoming frames (tick lookahead manager)
        await this.lookAhead.tick(currentTimelineFrame, activeProject, assets);

        // Identify active video clips at this frame
        const videoTracks = timeline.tracks.filter(isVideoTrack);
        const activeClipsToRender: Clip[] = [];

        videoTracks.forEach((track: any) => {
          const activeClips = track.clips.filter(
            (clip: any) =>
              clip.asset_id &&
              currentTimelineFrame >= clip.timeline_in &&
              currentTimelineFrame < clip.timeline_out,
          );
          activeClipsToRender.push(...activeClips);
        });

        effectsTracks.forEach((track: any) => {
          const activeClips = track.clips.filter(
            (clip: any) =>
              clip.effect_type === 'text' &&
              currentTimelineFrame >= clip.timeline_in &&
              currentTimelineFrame < clip.timeline_out,
          );
          activeClipsToRender.push(...activeClips);
        });

        // Sort by z_index
        activeClipsToRender.sort((a, b) => getZIndex(a) - getZIndex(b));

        // Synchronously block until all active frames are decoded into the session queues
        for (const clip of activeClipsToRender) {
          if (clip.effect_type !== 'text') {
            await this.awaitFrameDecoded(
              clip,
              currentTimelineFrame,
              framerate,
              activeProject,
              assets,
            );
          }
        }

        // Resolve zoom scale factor active at this specific frameIndex
        const activeZoomClip = effectsTracks
          .flatMap((t: any) => t.clips)
          .find(
            (clip: any) =>
              clip.effect_type === 'zoom' &&
              currentTimelineFrame >= clip.timeline_in &&
              currentTimelineFrame < clip.timeline_out,
          );
        const resolvedZoom = activeZoomClip?.effect_config?.scale ?? 1.0;

        // 3. Render offscreen directly into canvas
        const tempFramesToClose: VideoFrame[] = [];

        this.renderer.beginFrame(background);
        for (const clip of activeClipsToRender) {
          if (clip.effect_type === 'text') {
            const config = clip.effect_config || {};

            let canvas: OffscreenCanvas;
            const cached = this.textCanvasCache.get(clip.id);

            if (
              cached &&
              cached.config === config &&
              cached.width === this.width &&
              cached.height === this.height
            ) {
              canvas = cached.canvas;
            } else {
              canvas = new OffscreenCanvas(this.width, this.height);
              drawTextToCanvas(canvas, clip);
              this.textCanvasCache.set(clip.id, {
                canvas,
                config,
                width: this.width,
                height: this.height,
              });
            }

            const textFrame = new VideoFrame(canvas, { timestamp: 0 });
            tempFramesToClose.push(textFrame);
            const evaluatedTransform = applySingleClipTransitions(
              evaluateTransform(
                clip.transform,
                currentTimelineFrame,
                resolvedZoom,
              ),
              clip,
              currentTimelineFrame,
            );
            this.renderer.drawClip(textFrame, evaluatedTransform as any);
          } else {
            const frame = this.lookAhead.getFrame(
              clip.id,
              currentTimelineFrame,
              framerate,
            );
            if (frame) {
              const evaluatedTransform = applySingleClipTransitions(
                evaluateTransform(
                  clip.transform,
                  currentTimelineFrame,
                  resolvedZoom,
                ),
                clip,
                currentTimelineFrame,
              );
              this.renderer.drawClip(frame, evaluatedTransform as any);
            }
          }
        }
        this.renderer.endFrame();

        for (const frame of tempFramesToClose) {
          frame.close();
        }

        // 4. Create a VideoFrame directly from the OffscreenCanvas (no GPU-CPU backread!)
        const offscreenCanvas = (this.renderer as any).canvas;
        if (!offscreenCanvas) {
          throw new Error(
            'WebGPURenderer is not configured with an offscreen canvas',
          );
        }

        const timestampMicros = Math.round(
          (outputFrameIndex * 1_000_000) / framerate,
        );
        const videoFrame: VideoFrame = new VideoFrame(offscreenCanvas, {
          timestamp: timestampMicros,
          duration: Math.round(1_000_000 / framerate),
        });

        // 5. Feed the frame to the hardware encoder
        this.encoder.encode(videoFrame);
        videoFrame.close();

        // Backpressure: Yield to main thread instantly if WebCodecs queue is full
        while (this.encoder.encodeQueueSize > 24) {
          await yieldToMainThread();
        }

        // Backpressure: Thread-safe await of Tauri writes if more than 64 are pending
        if (this.pendingChunks.length > 64) {
          const chunksToWait = [...this.pendingChunks];
          this.pendingChunks = [];
          await Promise.all(chunksToWait);
        }

        // Resolve the active speed factor at the current timeline frame position
        const activeSpeedClip = speedClips.find(
          (clip: any) =>
            currentTimelineFrame >= clip.timeline_in &&
            currentTimelineFrame < clip.timeline_out,
        );
        const activeSpeedFactor = activeSpeedClip?.speed_factor ?? 1.0;

        // Warp the playhead step
        timelinePlayhead += activeSpeedFactor;
        outputFrameIndex++;

        // 6. Update progress indicator
        if (onProgress) {
          onProgress(0.05 + (timelinePlayhead / totalFrames) * 0.8);
        }
      }

      // Flush remaining video frames from the encoder buffer
      console.log('[ExportEngine] Flushing video encoder...');
      await this.encoder.flush();
      await Promise.all(this.pendingChunks);
      console.log('[ExportEngine] All video frames written to backend.');

      if (onPhaseChange) onPhaseChange('audio');

      console.log('[Export] Rendering audio timeline in chunks...');
      const durationSeconds = totalFrames / framerate;
      const chunkSizeSeconds = AUDIO_CHUNK_SIZE_SECONDS;

      for (
        let startSec = 0;
        startSec < durationSeconds;
        startSec += chunkSizeSeconds
      ) {
        if (this.disposed) {
          throw new Error('cancelled');
        }

        const chunkDuration = Math.min(
          chunkSizeSeconds,
          durationSeconds - startSec,
        );
        console.log(
          `[Export] Rendering audio chunk: ${startSec}s to ${startSec + chunkDuration}s`,
        );

        // Render chunk
        const pcmBytes = await exportAudioChunk(
          activeProject,
          assets,
          startSec,
          chunkDuration,
          extractedAudios,
        );

        // Stream raw PCM bytes to Tauri (will append to temp file)
        await exportApi.writeAudioChunk(pcmBytes);

        if (onProgress) {
          onProgress(0.85 + (startSec / durationSeconds) * 0.1);
        }
      }

      if (onPhaseChange) onPhaseChange('muxing');
      if (onProgress) onProgress(0.95);
    } catch (err: any) {
      if (err.message === 'cancelled') {
        console.log(
          '[ExportEngine] Export execution halted due to cancellation.',
        );
        await exportApi.cancel();
      }
      throw err;
    } finally {
      if (!this.disposed) {
        await exportApi.finish();
        if (onProgress) onProgress(1.0);
        if (onPhaseChange) onPhaseChange('completed');
      }
    }

    console.log('[ExportEngine] Export loop finished.');
  }

  /**
   * Generates a tiled storyboard strip of key scene changes.
   * Utilizes a highly optimized two-pass CPU-GPU visual pipeline.
   */
  public async generateStoryboard(
    activeProject: Project,
    assets: Asset[],
    options: {
      startFrame?: number;
      endFrame?: number;
      tileWidth?: number;
      tileHeight?: number;
      columns?: number;
      maxTiles?: number;
      madThreshold?: number;
      coverageFloorSeconds?: number;
      candidateIntervalSeconds?: number;
    } = {},
  ): Promise<{
    pixels: Uint8Array;
    width: number;
    height: number;
    timestamps: number[];
  }> {
    return generateStoryboardImpl(
      this.width,
      this.height,
      () => this.disposed,
      activeProject,
      assets,
      options,
    );
  }
}
