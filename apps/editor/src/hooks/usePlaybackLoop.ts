import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/timelineStore';
import { useProjectStore } from '../store/projectStore';
import { fpsToNumeric } from '../helpers/fps';
import { type VideoEngine, type AudioEngine, getZIndex } from '@rush/engine';
import { isEffectsTrack, isVideoTrack } from '@/constants/trackConfig';

/**
 * usePlaybackLoop drives the frame-by-frame progression of the project.
 * It synchronizes the video engine and audio engine based on the hardware clock.
 */
export function usePlaybackLoop(
  videoEngine: VideoEngine | null,
  audioEngine?: AudioEngine | null,
  audioCtx?: AudioContext | null,
) {
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlayhead = useAppStore((state) => state.setPlayhead);

  const activeProject = useProjectStore((state) => state.activeProject);
  const framerate = fpsToNumeric(activeProject?.framerate);
  const assets = useProjectStore((state) => state.assets);

  const requestRef = useRef<number>(null);

  // A/V Sync Refs
  const playbackStartTime = useRef<number>(0);
  const playbackStartPlayhead = useRef<number>(0);
  const playheadFloatRef = useRef<number>(0);
  const lastTickTime = useRef<number>(0);
  const lastAudioTimeRef = useRef<number | null>(null);

  // Synchronize active project configuration to the audio engine dynamically
  useEffect(() => {
    if (!audioEngine || !activeProject) return;

    const timeline = activeProject.timeline_state;
    const speedClips =
      timeline?.tracks
        .filter((t: any) => t.track_type?.toLowerCase() === 'effects')
        .flatMap((t: any) => t.clips)
        .filter(
          (c: any) =>
            (c.transform === undefined || c.transform === null) &&
            c.speed_factor !== undefined &&
            c.speed_factor !== null,
        ) || [];

    audioEngine.updateProjectConfig(speedClips, framerate);
  }, [audioEngine, activeProject, framerate]);

  useEffect(() => {
    const tick = (now: number) => {
      if (!isPlaying) return;

      const timeline = activeProject?.timeline_state;
      const effectsTracks = timeline?.tracks.filter(isEffectsTrack) || [];
      const activeSpeedClip = effectsTracks
        .flatMap((t: any) => t.clips)
        .find(
          (clip: any) =>
            (clip.transform === undefined || clip.transform === null) &&
            clip.speed_factor !== undefined &&
            clip.speed_factor !== null &&
            playheadFloatRef.current >= clip.timeline_in &&
            playheadFloatRef.current < clip.timeline_out,
        );
      const currentSpeed = activeSpeedClip?.speed_factor ?? 1.0;

      if (audioCtx) {
        // Master clock derived from hardware audio context deltas
        const nowAudioTime = audioCtx.currentTime;
        const deltaSeconds =
          nowAudioTime - (lastAudioTimeRef.current ?? nowAudioTime);
        lastAudioTimeRef.current = nowAudioTime;
        playheadFloatRef.current += deltaSeconds * framerate * currentSpeed;
      } else {
        // Fallback to high-precision performance clock
        const delta = (now - lastTickTime.current) / 1000;
        playheadFloatRef.current += delta * framerate * currentSpeed;
      }

      lastTickTime.current = now;

      const currentPlayhead = Math.floor(playheadFloatRef.current);

      // 1. UPDATE UI (Integer-based)
      if (currentPlayhead !== useAppStore.getState().playhead_position) {
        setPlayhead(currentPlayhead);
      }

      // 2. UPDATE VIDEO (High-precision every tick)
      const videoTracks = timeline?.tracks.filter(isVideoTrack) || [];

      if (videoEngine) {
        // Trigger look-ahead buffering in the background (Non-Blocking!)
        if (activeProject) {
          void videoEngine.tick(currentPlayhead, activeProject, assets);
        }

        // Identify all video clips that should be visible on screen right now
        const activeClipsToRender: any[] = [];

        videoTracks.forEach((track: any) => {
          const activeClips = track.clips.filter(
            (clip: any) =>
              clip.asset_id &&
              playheadFloatRef.current >= clip.timeline_in &&
              playheadFloatRef.current < clip.timeline_out,
          );
          activeClipsToRender.push(...activeClips);
        });

        effectsTracks.forEach((track: any) => {
          const activeClips = track.clips.filter(
            (clip: any) =>
              clip.effect_type === 'text' &&
              playheadFloatRef.current >= clip.timeline_in &&
              playheadFloatRef.current < clip.timeline_out,
          );
          activeClipsToRender.push(...activeClips);
        });

        // Sort by z_index so overlays are drawn on top of backgrounds
        activeClipsToRender.sort((a, b) => getZIndex(a) - getZIndex(b));

        // Find active global zoom multiplier
        const activeEffectsClip = effectsTracks
          .flatMap((t: any) => t.clips)
          .find(
            (clip: any) =>
              playheadFloatRef.current >= clip.timeline_in &&
              playheadFloatRef.current < clip.timeline_out,
          );
        const globalZoom =
          activeEffectsClip?.effect_type === 'zoom'
            ? (activeEffectsClip.effect_config?.scale ?? 1.0)
            : 1.0;

        // Render the pre-decoded frames to the WebGPU canvas
        videoEngine.renderFrame(
          currentPlayhead,
          activeClipsToRender,
          framerate,
          activeProject?.timeline_state.background,
          globalZoom,
        );
      }

      // UPDATE AUDIO
      if (audioEngine) {
        audioEngine.decodeNextBatch(10); // Increase look-ahead depth to 10 samples per tick
      }

      requestRef.current = requestAnimationFrame(tick) as any;
    };

    if (isPlaying) {
      const currentPos = useAppStore.getState().playhead_position;
      playheadFloatRef.current = currentPos;
      lastTickTime.current = performance.now();

      if (audioCtx) {
        playbackStartTime.current = audioCtx.currentTime;
        playbackStartPlayhead.current = currentPos;
        lastAudioTimeRef.current = audioCtx.currentTime;

        if (audioEngine) {
          // Sync all tracks to the new start point
          audioEngine.setPlaybackSync(
            playbackStartTime.current,
            playbackStartPlayhead.current,
            framerate,
          );
        }
      }

      requestRef.current = requestAnimationFrame(tick) as any;
    } else if (requestRef.current) {
      if (audioEngine) {
        audioEngine.stop();
      }
      cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (audioEngine) {
        audioEngine.stop();
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    isPlaying,
    framerate,
    videoEngine,
    audioEngine,
    audioCtx,
    activeProject,
    setPlayhead,
    assets,
  ]);
}
