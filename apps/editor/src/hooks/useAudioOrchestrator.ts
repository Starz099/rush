import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/timelineStore';
import { useProjectStore } from '../store/projectStore';
import {
  AudioEngine,
  MP4AudioProvider,
  StandaloneAudioProvider,
} from '@rush/engine';
import { fpsToNumeric } from '../helpers/fps';

export function useAudioOrchestrator(
  audioEngine: AudioEngine | null,
  audioCtx: AudioContext | null,
) {
  const activeProject = useProjectStore((state) => state.activeProject);
  const assets = useProjectStore((state) => state.assets);
  const playhead = useAppStore((state) => state.playhead_position);
  const readyAssets = useAppStore((state) => state.readyAssets);
  const framerate = fpsToNumeric(activeProject?.framerate);

  // Track which clip IDs are currently loaded in the engine
  const mountedClipIds = useRef<Set<string>>(new Set());
  const isInitializing = useRef<Set<string>>(new Set());
  const failedClipIds = useRef<Set<string>>(new Set());
  const mountedClipMetadata = useRef<Map<string, any>>(new Map());

  // Track readiness for the UI
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    if (!audioEngine || !audioCtx || !activeProject) return;

    const timeline = activeProject.timeline_state;

    // PRELOAD LOGIC: Look 5 seconds ahead and 1 second behind
    const preloadBufferFrames = framerate * 5;
    const trailingBufferFrames = framerate * 1;

    const clipsToMount = timeline.tracks.flatMap((track: any) =>
      track.clips.filter((clip: any) => {
        if (!clip.asset_id) return false;
        const asset = assets.find((a) => a.id === clip.asset_id);
        const hasAudio =
          asset &&
          (asset.media_type === 'audio' || asset.media_type === 'video');
        const isAssetReady = asset ? !!readyAssets[asset.id] : false;
        return (
          hasAudio &&
          isAssetReady &&
          playhead < clip.timeline_out + trailingBufferFrames &&
          playhead > clip.timeline_in - preloadBufferFrames &&
          !failedClipIds.current.has(clip.id)
        );
      }),
    );

    // AUDIBILITY CHECK: Which ones actually need to be ready for sound RIGHT NOW
    const audibleClips = clipsToMount.filter(
      (clip) => playhead >= clip.timeline_in && playhead < clip.timeline_out,
    );

    const requiredIds = new Set(clipsToMount.map((c) => c.id));
    const currentAudibleIds = new Set(audibleClips.map((c) => c.id));

    // REMOVE CLIPS that are far away
    mountedClipIds.current.forEach((id) => {
      if (!requiredIds.has(id)) {
        audioEngine.removeTrack(id);
        mountedClipIds.current.delete(id);
        mountedClipMetadata.current.delete(id);
        console.log(`[Orchestrator] Disposed distant track: ${id}`);
      }
    });

    // REMOVE CLIPS that have been modified (to force remount)
    mountedClipIds.current.forEach((id) => {
      const activeClip = clipsToMount.find((c) => c.id === id);
      const cachedClip = mountedClipMetadata.current.get(id);
      if (activeClip && cachedClip) {
        if (
          cachedClip.asset_id !== activeClip.asset_id ||
          cachedClip.timeline_in !== activeClip.timeline_in ||
          cachedClip.timeline_out !== activeClip.timeline_out ||
          cachedClip.source_in !== activeClip.source_in ||
          cachedClip.source_out !== activeClip.source_out
        ) {
          console.log(`[Orchestrator] Remounting modified track: ${id}`);
          audioEngine.removeTrack(id);
          mountedClipIds.current.delete(id);
          mountedClipMetadata.current.delete(id);
        }
      }
    });

    // ADD CLIPS that are approaching
    clipsToMount.forEach(async (clip) => {
      if (
        !mountedClipIds.current.has(clip.id) &&
        !isInitializing.current.has(clip.id) &&
        !failedClipIds.current.has(clip.id)
      ) {
        const asset = assets.find((a) => a.id === clip.asset_id);
        if (!asset) return;

        isInitializing.current.add(clip.id);

        // Update ready state if we need this clip immediately
        if (currentAudibleIds.has(clip.id)) {
          setIsReady(false);
        }

        try {
          const extractedAudioPath =
            useAppStore.getState().extractedAudios[asset.id];
          const audioPathToUse = extractedAudioPath || asset.file_path;
          const isMp3 =
            audioPathToUse.toLowerCase().endsWith('.mp3') ||
            asset.media_type === 'audio';

          const provider = isMp3
            ? new StandaloneAudioProvider(audioPathToUse, audioCtx)
            : new MP4AudioProvider(audioPathToUse);

          console.log(
            `[Orchestrator] Preloading track: ${clip.id} (mode: ${isMp3 ? 'Standalone/MP3' : 'MP4'}) using path: ${audioPathToUse}`,
          );

          const timelineEnd = clip.timeline_out / framerate;
          const sourceEnd = clip.source_out / framerate;

          await audioEngine.addTrack(
            clip.id,
            provider,
            clip.timeline_in / framerate,
            clip.source_in / framerate,
            timelineEnd,
            sourceEnd,
          );

          const pipeline = audioEngine.getTrack(clip.id);
          if (pipeline) {
            const sourceTime =
              (playhead - clip.timeline_in + clip.source_in) / framerate;
            const clampedSourceTime = Math.max(
              clip.source_in / framerate,
              sourceTime,
            );
            pipeline.seek(clampedSourceTime);
          }

          mountedClipIds.current.add(clip.id);
          mountedClipMetadata.current.set(clip.id, { ...clip });
        } catch (e) {
          console.error(`[Orchestrator] Preload failed for ${clip.id}:`, e);
          failedClipIds.current.add(clip.id);
        } finally {
          isInitializing.current.delete(clip.id);

          // Re-check overall readiness
          const stillLoadingAudible = audibleClips.some((c) =>
            isInitializing.current.has(c.id),
          );
          setIsReady(!stillLoadingAudible);
        }
      }
    });

    // Update readiness based on currently audible clips
    const loadingAudible = audibleClips.some((c) =>
      isInitializing.current.has(c.id),
    );
    if (isReady === loadingAudible) {
      // If state needs flipping
      setIsReady(!loadingAudible);
    }
  }, [
    playhead,
    activeProject,
    assets,
    audioEngine,
    audioCtx,
    framerate,
    readyAssets,
  ]);

  return { isReady };
}
