import { WebGPURenderer } from '../core/Renderer';
import type { Project, Clip, Asset } from '@/api/bindings';
import { fpsToNumeric } from '../helpers/fps';
import { isVideoTrack } from '../helpers/track';
import { evaluateTransform, applySingleClipTransitions } from '../VideoEngine';
import { SimpleClipDecoder } from './SimpleClipDecoder';
import { StoryboardDownsampler } from './StoryboardDownsampler';
import { StoryboardTiler } from './StoryboardTiler';
import { calculateMAD } from './utils';

export async function generateStoryboardImpl(
  rendererWidth: number,
  rendererHeight: number,
  isDisposedCallback: () => boolean,
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
  const storyboardRenderer = new WebGPURenderer({
    width: rendererWidth,
    height: rendererHeight,
  });
  await storyboardRenderer.initialize();

  const device = (storyboardRenderer as any).device as GPUDevice;
  if (!device) {
    throw new Error('WebGPU Device is not initialized.');
  }

  const tileWidth = options.tileWidth ?? 320;
  const tileHeight = options.tileHeight ?? 180;
  const columns = options.columns ?? 6;
  const maxTiles = options.maxTiles ?? 36;
  const madThreshold = options.madThreshold ?? 0.05;
  const coverageFloorSeconds = options.coverageFloorSeconds ?? 5.0;
  const candidateIntervalSeconds = options.candidateIntervalSeconds ?? 2.0;

  const timeline = activeProject.timeline_state;
  const framerate = fpsToNumeric(activeProject.framerate);
  const background = timeline.background;

  const effectsTracks = timeline.tracks.filter(
    (t: any) => t.track_type?.toLowerCase() === 'effects',
  );

  const videoTracks = timeline.tracks.filter(isVideoTrack);
  const allVideoClips = videoTracks.flatMap((track: any) => track.clips);
  let totalFrames = allVideoClips.reduce(
    (max: number, clip: any) => Math.max(max, clip.timeline_out),
    0,
  );
  if (totalFrames === 0) {
    totalFrames = timeline.tracks
      .filter((t: any) => t.track_type?.toLowerCase() !== 'effects')
      .flatMap((track: any) => track.clips)
      .reduce((max: number, clip: any) => Math.max(max, clip.timeline_out), 0);
  }

  const start = options.startFrame ?? 0;
  const end = options.endFrame ?? totalFrames;

  const intervalFrames = Math.max(
    Math.round(candidateIntervalSeconds * framerate),
    1,
  );

  const candidateFrames: number[] = [];
  for (let f = start; f < end; f += intervalFrames) {
    candidateFrames.push(f);
  }
  if (candidateFrames.length === 0) {
    candidateFrames.push(start);
  }

  //MARK:SCAN
  console.log(
    `[Storyboard] Starting Pass 1: Scan. Total Candidates: ${candidateFrames.length}`,
  );

  const decoders = new Map<string, SimpleClipDecoder>();
  const getDecoderForClip = async (clip: Clip) => {
    let dec = decoders.get(clip.id);
    if (!dec) {
      const asset = assets.find((a) => a.id === clip.asset_id);
      if (!asset) return null;
      dec = new SimpleClipDecoder(asset.file_path);
      await dec.initialize();
      decoders.set(clip.id, dec);
    }
    return dec;
  };

  const downsampler = new StoryboardDownsampler(device);
  let selectedCandidates: { frameIndex: number; luma: Float32Array }[] = [];

  // --- PASS 1: SCAN TIMELINE & DETECT CUTS ---
  for (const frameIndex of candidateFrames) {
    if (isDisposedCallback()) throw new Error('cancelled');

    const activeClipsToRender: Clip[] = [];
    videoTracks.forEach((track: any) => {
      const activeClips = track.clips.filter(
        (clip: any) =>
          clip.asset_id &&
          frameIndex >= clip.timeline_in &&
          frameIndex < clip.timeline_out,
      );
      activeClipsToRender.push(...activeClips);
    });

    activeClipsToRender.sort(
      (a, b) => (a.transform?.z_index || 0) - (b.transform?.z_index || 0),
    );

    const activeZoomClip = effectsTracks
      .flatMap((t: any) => t.clips)
      .find(
        (clip: any) =>
          clip.transform?.scale !== undefined &&
          clip.transform?.scale !== null &&
          frameIndex >= clip.timeline_in &&
          frameIndex < clip.timeline_out,
      );
    const resolvedZoom = activeZoomClip?.transform?.scale ?? 1.0;

    storyboardRenderer.beginFrame(background);
    const framesToClose: VideoFrame[] = [];
    for (const clip of activeClipsToRender) {
      const decoder = await getDecoderForClip(clip);
      if (decoder) {
        const clipInSec = clip.timeline_in / framerate;
        const sourcePlayheadSeconds =
          frameIndex / framerate - clipInSec + clip.source_in / framerate;

        const frame = await decoder.getKeyframeNear(sourcePlayheadSeconds);
        if (frame) {
          const evaluatedTransform = applySingleClipTransitions(
            evaluateTransform(clip.transform, frameIndex, resolvedZoom),
            clip,
            frameIndex,
          );

          storyboardRenderer.drawClip(frame, evaluatedTransform as any);
          framesToClose.push(frame);
        }
      }
    }
    storyboardRenderer.endFrame();

    for (const frame of framesToClose) {
      frame.close();
    }

    const sourceTexture = (storyboardRenderer as any)
      .offscreenTexture as GPUTexture;
    const currentLuma = await downsampler.getFrameLumaGrid(sourceTexture);

    let keep = false;
    if (selectedCandidates.length === 0) {
      keep = true;
    } else {
      const lastKept = selectedCandidates[selectedCandidates.length - 1];
      const elapsedSeconds = (frameIndex - lastKept.frameIndex) / framerate;
      const mad = calculateMAD(currentLuma, lastKept.luma);

      if (elapsedSeconds >= 0.5) {
        if (mad > madThreshold || elapsedSeconds >= coverageFloorSeconds) {
          keep = true;
        }
      }
    }

    if (keep) {
      selectedCandidates.push({ frameIndex, luma: currentLuma });
    }
  }

  downsampler.dispose();

  console.log(
    `[Storyboard] Scan complete. Found ${selectedCandidates.length} potential cuts.`,
  );

  if (selectedCandidates.length > maxTiles) {
    console.log(
      `[Storyboard] Decimating ${selectedCandidates.length} tiles down to max limit of ${maxTiles}.`,
    );
    const step = selectedCandidates.length / maxTiles;
    const decimated: typeof selectedCandidates = [];
    for (let i = 0; i < maxTiles; i++) {
      decimated.push(selectedCandidates[Math.floor(i * step)]);
    }
    selectedCandidates = decimated;
  }

  if (selectedCandidates.length === 0) {
    for (const dec of decoders.values()) {
      dec.dispose();
    }
    storyboardRenderer.dispose();
    throw new Error('No frames were selected for the storyboard.');
  }

  //MARK:TILING
  console.log(
    `[Storyboard] Starting Pass 2: Rendering & Tiling final ${selectedCandidates.length} frames.`,
  );

  const cols = Math.min(columns, selectedCandidates.length);
  const rows = Math.ceil(selectedCandidates.length / cols);
  const storyboardWidth = cols * tileWidth;
  const storyboardHeight = rows * tileHeight;

  const storyboardTexture = device.createTexture({
    size: [storyboardWidth, storyboardHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const clearEncoder = device.createCommandEncoder();
  const clearPass = clearEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: storyboardTexture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });
  clearPass.end();
  device.queue.submit([clearEncoder.finish()]);

  const tiler = new StoryboardTiler(device);

  for (let i = 0; i < selectedCandidates.length; i++) {
    const candidate = selectedCandidates[i];
    const frameIndex = candidate.frameIndex;

    const activeClipsToRender: Clip[] = [];
    videoTracks.forEach((track: any) => {
      const activeClips = track.clips.filter(
        (clip: any) =>
          clip.asset_id &&
          frameIndex >= clip.timeline_in &&
          frameIndex < clip.timeline_out,
      );
      activeClipsToRender.push(...activeClips);
    });

    activeClipsToRender.sort(
      (a, b) => (a.transform?.z_index || 0) - (b.transform?.z_index || 0),
    );

    const activeZoomClip = effectsTracks
      .flatMap((t: any) => t.clips)
      .find(
        (clip: any) =>
          clip.transform?.scale !== undefined &&
          clip.transform?.scale !== null &&
          frameIndex >= clip.timeline_in &&
          frameIndex < clip.timeline_out,
      );
    const resolvedZoom = activeZoomClip?.transform?.scale ?? 1.0;

    storyboardRenderer.beginFrame(background);
    const framesToClose: VideoFrame[] = [];
    for (const clip of activeClipsToRender) {
      const decoder = await getDecoderForClip(clip);
      if (decoder) {
        const clipInSec = clip.timeline_in / framerate;
        const sourcePlayheadSeconds =
          frameIndex / framerate - clipInSec + clip.source_in / framerate;

        const frame = await decoder.getKeyframeNear(sourcePlayheadSeconds);
        if (frame) {
          const evaluatedTransform = applySingleClipTransitions(
            evaluateTransform(clip.transform, frameIndex, resolvedZoom),
            clip,
            frameIndex,
          );

          storyboardRenderer.drawClip(frame, evaluatedTransform as any);
          framesToClose.push(frame);
        }
      }
    }
    storyboardRenderer.endFrame();

    for (const frame of framesToClose) {
      frame.close();
    }

    const sourceTexture = (storyboardRenderer as any)
      .offscreenTexture as GPUTexture;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * tileWidth;
    const y = row * tileHeight;

    tiler.copyFrameToTile(
      sourceTexture,
      storyboardTexture,
      x,
      y,
      tileWidth,
      tileHeight,
    );
  }

  // --- FINAL DOWNLOAD ---
  console.log(
    '[Storyboard] Downloading final stitched canvas texture to CPU...',
  );
  const bytesPerPixel = 4;
  const bytesPerRow = storyboardWidth * bytesPerPixel;
  const bufferSize = bytesPerRow * storyboardHeight;

  const stagingBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const downloadEncoder = device.createCommandEncoder();
  downloadEncoder.copyTextureToBuffer(
    { texture: storyboardTexture },
    { buffer: stagingBuffer, bytesPerRow: bytesPerRow },
    { width: storyboardWidth, height: storyboardHeight },
  );
  device.queue.submit([downloadEncoder.finish()]);

  await stagingBuffer.mapAsync(GPUMapMode.READ);

  const mappedRange = stagingBuffer.getMappedRange();
  const outputPixels = new Uint8Array(mappedRange.byteLength);
  outputPixels.set(new Uint8Array(mappedRange));

  stagingBuffer.unmap();
  stagingBuffer.destroy();
  storyboardTexture.destroy();

  for (const dec of decoders.values()) {
    dec.dispose();
  }
  decoders.clear();

  storyboardRenderer.dispose();

  //MARK:WATERMARK
  console.log('[Storyboard] Burning timestamp labels onto thumbnails...');
  const canvas = new OffscreenCanvas(storyboardWidth, storyboardHeight);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(storyboardWidth, storyboardHeight);
    imgData.data.set(outputPixels);
    ctx.putImageData(imgData, 0, 0);

    ctx.font = 'bold 12px sans-serif';
    ctx.textBaseline = 'bottom';

    for (let i = 0; i < selectedCandidates.length; i++) {
      const candidate = selectedCandidates[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * tileWidth;
      const y = row * tileHeight;

      const timeInSec = candidate.frameIndex / framerate;
      const minutes = Math.floor(timeInSec / 60);
      const seconds = Math.floor(timeInSec % 60);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      const textWidth = ctx.measureText(timeStr).width;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(x + 6, y + tileHeight - 24, textWidth + 10, 18);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(timeStr, x + 11, y + tileHeight - 8);
    }

    const finalImgData = ctx.getImageData(
      0,
      0,
      storyboardWidth,
      storyboardHeight,
    );
    outputPixels.set(finalImgData.data);
  }

  const timestamps = selectedCandidates.map((c) => c.frameIndex / framerate);

  console.log(
    `[Storyboard] Success! Generated grid: ${cols}x${rows} (${storyboardWidth}x${storyboardHeight})`,
  );

  return {
    pixels: outputPixels,
    width: storyboardWidth,
    height: storyboardHeight,
    timestamps,
  };
}
