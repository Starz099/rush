import { useProjectStore } from '@/store/projectStore';
import { useAppStore } from '@/store/timelineStore';
import { usePlaybackLoop } from '@/hooks/usePlaybackLoop';
import { convertFileSrc } from '@tauri-apps/api/core';
import { FileIcon, FilmStripIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { WebGPURenderer } from '../engine/core/Renderer';
import { VideoEngine } from '../engine/VideoEngine';
import { AudioEngine } from '../engine/audio/AudioEngine';
import { ExportEngine } from '../engine/export/ExportEngine';
import { useAudioOrchestrator } from '@/hooks/useAudioOrchestrator';
import { fpsToNumeric } from '@/helpers/fps';
import { isVideoTrack } from '@/constants/trackConfig';

export const PreviewPanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject);
  const assets = useProjectStore((state) => state.assets);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Engine Refs
  const videoEngineRef = useRef<VideoEngine | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);

  const [videoEngine, setVideoEngine] = useState<VideoEngine | null>(null);
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const isPlaying = useAppStore((state) => state.isPlaying);
  const playheadPosition = useAppStore((state) => state.playhead_position);
  const readyAssets = useAppStore((state) => state.readyAssets);
  const demuxingAssets = useAppStore((state) => state.demuxingAssets);

  const timeline = activeProject?.timeline_state;
  const videoTracks = timeline?.tracks.filter(isVideoTrack) || [];

  // Active clips for scrubbing and UI hints
  const activeClips = videoTracks.flatMap((track: any) =>
    track.clips.filter(
      (clip: any) =>
        playheadPosition >= clip.timeline_in &&
        playheadPosition < clip.timeline_out,
    ),
  );

  const activeAsset =
    activeClips.length > 0
      ? assets.find((a) => a.id === activeClips[0].asset_id)
      : null;

  const previewWidth = activeProject?.viewport_width ?? 1920;
  const previewHeight = activeProject?.viewport_height ?? 1080;
  const projectFps = fpsToNumeric(activeProject?.framerate);

  // Initialize Engines once on mount
  useEffect(() => {
    let cancelled = false;

    const initEngines = async () => {
      // Wait for canvas to be available in the DOM
      if (!canvasRef.current) {
        // Retry in next tick if not ready
        setTimeout(initEngines, 50);
        return;
      }

      try {
        setIsInitializing(true);

        // 1. Audio Engine
        if (!audioEngineRef.current) {
          const ctx = new AudioContext({ sampleRate: 48000 });
          setAudioCtx(ctx);
          const aEngine = new AudioEngine(ctx);
          audioEngineRef.current = aEngine;
          setAudioEngine(aEngine);
        }

        // 2. Video Engine (with shared Renderer)
        if (canvasRef.current && !videoEngineRef.current) {
          canvasRef.current.width = previewWidth;
          canvasRef.current.height = previewHeight;

          const renderer = new WebGPURenderer(canvasRef.current);
          await renderer.initialize();

          if (cancelled) {
            renderer.dispose();
            return;
          }

          const vEngine = new VideoEngine(renderer);
          videoEngineRef.current = vEngine;
          setVideoEngine(vEngine);
        }
      } catch (error) {
        console.error('Failed to initialize engines:', error);
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    initEngines();

    return () => {
      cancelled = true;
      audioEngineRef.current?.dispose();
      videoEngineRef.current?.dispose();
      audioEngineRef.current = null;
      videoEngineRef.current = null;
    };
  }, []); // Mount-only

  // Attach the engine to the playback loop
  usePlaybackLoop(videoEngine, audioEngine, audioCtx);

  // Attach Orchestrators to manage tracks/clips
  useAudioOrchestrator(audioEngine, audioCtx);

  // Temporary listener to test the offscreen rendering & capture pipeline
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl + Shift + E to trigger the offscreen export test
      if (e.key === 'E' && e.ctrlKey && e.shiftKey && activeProject) {
        e.preventDefault();
        console.log(
          `[Test Export] Triggered offscreen render export test at playhead: ${playheadPosition}`,
        );
        try {
          // We use 1920x1080 to test both the offscreen logic AND non-256-aligned width padding rules!
          const exportWidth = activeProject.viewport_width;
          const exportHeight = activeProject.viewport_height;
          const exporter = new ExportEngine(exportWidth, exportHeight);
          await exporter.initialize();

          const pixels = await exporter.testExportSingleFrame(
            playheadPosition,
            activeProject,
            assets,
          );

          console.log(
            `%c[Test Export SUCCESS] Captured Frame at Resolution: ${exportWidth}x${exportHeight}`,
            'color: #00ff00; font-weight: bold;',
          );
          console.log(
            `[Test Export SUCCESS] Total Bytes Extracted: ${pixels.byteLength}`,
          );
          console.log(
            `[Test Export SUCCESS] Expected clean byte size: ${exportWidth * exportHeight * 4}`,
          );
          console.log(
            `[Test Export SUCCESS] First 16 bytes:`,
            Array.from(pixels.slice(0, 16)),
          );

          exporter.dispose();
        } catch (err) {
          console.error(
            `%c[Test Export ERROR]`,
            'color: #ff0000; font-weight: bold;',
            err,
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playheadPosition, activeProject, assets]);

  const isActiveAssetLoading = activeAsset
    ? activeAsset.media_type === 'video' &&
      (!readyAssets[activeAsset.id] || demuxingAssets[activeAsset.id])
    : false;

  // Auto-prepare assets present in the timeline
  useEffect(() => {
    if (!activeProject || assets.length === 0) return;

    const timeline = activeProject.timeline_state;

    // Find all unique asset IDs in the timeline (video and audio)
    const timelineAssetIds = new Set<string>();
    timeline.tracks.forEach((track: any) => {
      track.clips.forEach((clip: any) => {
        timelineAssetIds.add(clip.asset_id);
      });
    });

    const prepareAsset = useAppStore.getState().prepareAsset;

    timelineAssetIds.forEach((assetId) => {
      const asset = assets.find((a) => a.id === assetId);
      if (asset) {
        const isReady = useAppStore.getState().readyAssets[assetId];
        const isDemuxing = useAppStore.getState().demuxingAssets[assetId];

        if (!isReady && !isDemuxing) {
          console.log(
            `[PreviewPanel] Auto-preparing timeline asset: ${asset.name} (${assetId})`,
          );
          void prepareAsset(assetId, asset.file_path);
        }
      }
    });
  }, [activeProject, assets]);

  // Resume AudioContext on user interaction (Play)
  useEffect(() => {
    if (isPlaying && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, [isPlaying, audioCtx]);

  // Scrubbing logic (Sync when NOT playing)
  useEffect(() => {
    if (!isPlaying && videoEngine && activeProject) {
      videoEngine.reset(); // Clear all buffers and decoders

      const targetPlayhead = playheadPosition;
      // Fetch and decode the frame at the new playhead position
      void videoEngine.tick(targetPlayhead, activeProject, assets).then(() => {
        // Abort if the playhead has moved since this seek was scheduled
        if (useAppStore.getState().playhead_position !== targetPlayhead) {
          return;
        }

        // Sort by z_index so overlays are rendered correctly
        const sortedClips = [...activeClips].sort(
          (a, b) => (a.transform?.z_index || 0) - (b.transform?.z_index || 0),
        );

        // Find active global zoom multiplier
        const effectsTracks =
          timeline?.tracks.filter(
            (t: any) => t.track_type?.toLowerCase() === 'effects',
          ) || [];
        const activeEffectsClip = effectsTracks
          .flatMap((t: any) => t.clips)
          .find(
            (clip: any) =>
              targetPlayhead >= clip.timeline_in &&
              targetPlayhead < clip.timeline_out,
          );
        const globalZoom = activeEffectsClip?.transform?.scale ?? 1.0;

        // Render the frame immediately
        videoEngine.renderFrame(
          targetPlayhead,
          sortedClips,
          projectFps,
          activeProject.timeline_state.background,
          globalZoom,
        );
      });

      if (audioEngine) {
        audioEngine.seekByTime(playheadPosition / projectFps);
      }
    }
  }, [
    playheadPosition,
    isPlaying,
    videoEngine,
    audioEngine,
    activeClips.length,
    projectFps,
    activeProject,
    assets,
  ]);

  if (!activeProject) return null;

  return (
    <div className="flex h-full flex-col bg-black/40 p-4">
      <div className="relative mx-auto flex aspect-video w-full max-w-[90%] flex-1 items-center justify-center overflow-hidden border border-white/5 bg-black text-white/20 shadow-2xl">
        {(isInitializing || isActiveAssetLoading) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/5 bg-black/50 p-6 shadow-2xl">
              <div className="border-primary size-9 animate-spin rounded-full border-[3px] border-t-transparent shadow-inner" />
              <span className="text-[11px] font-bold tracking-widest text-white/90 uppercase">
                {isInitializing
                  ? 'Initializing Engines...'
                  : 'Preparing Video Asset...'}
              </span>
              {isActiveAssetLoading && (
                <span className="max-w-[200px] text-center text-[9px] tracking-wider text-white/40">
                  Parsing frame layouts & optimizing audio for zero-lag playback
                </span>
              )}
            </div>
          </div>
        )}

        {/* VIDEO LAYER - Always mounted to keep WebGPU context alive */}
        <canvas
          ref={canvasRef}
          style={{
            display: activeAsset?.media_type === 'image' ? 'none' : 'block',
          }}
          className="h-full w-full bg-white/5 object-contain"
          width={previewWidth}
          height={previewHeight}
        />

        {/* IMAGE LAYER */}
        {activeAsset?.media_type === 'image' && (
          <img
            src={convertFileSrc(activeAsset.file_path)}
            alt={activeAsset.name}
            className="h-full w-full bg-white/5 object-contain"
          />
        )}

        {/* FALLBACKS */}
        {!activeAsset && !isInitializing && !isActiveAssetLoading && (
          <div className="flex flex-col items-center gap-2">
            <FilmStripIcon className="size-12 opacity-10" />
            <span className="text-[10px] font-medium tracking-widest uppercase opacity-20">
              No Clip at Playhead
            </span>
          </div>
        )}

        {activeAsset &&
          activeAsset.media_type !== 'video' &&
          activeAsset.media_type !== 'image' && (
            <div className="text-center">
              <FileIcon className="mx-auto mb-2 size-12 opacity-20" />
              <p className="text-xs">Preview not available</p>
            </div>
          )}
      </div>
    </div>
  );
};
