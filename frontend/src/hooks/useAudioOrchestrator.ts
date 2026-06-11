import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/timelineStore'
import { useProjectStore } from '../store/projectStore'
import { AudioEngine } from '../engine/AudioEngine'
import { MP4AudioProvider } from '../engine/providers/MP4AudioProvider'
import { StandaloneAudioProvider } from '../engine/providers/StandaloneAudioProvider'
import { fpsToNumeric } from '../helpers/fps'

export function useAudioOrchestrator(
  audioEngine: AudioEngine | null,
  audioCtx: AudioContext | null,
) {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const playhead = useAppStore((state) => state.playhead_position)
  const framerate = fpsToNumeric(activeProject?.framerate)

  // Track which clip IDs are currently loaded in the engine
  const mountedClipIds = useRef<Set<string>>(new Set())
  const isInitializing = useRef<Set<string>>(new Set())

  // Track readiness for the UI
  const [isReady, setIsReady] = useState(true)

  useEffect(() => {
    if (!audioEngine || !audioCtx || !activeProject) return

    const timeline = activeProject.timeline_state

    // PRELOAD LOGIC: Look 5 seconds ahead and 1 second behind
    const preloadBufferFrames = framerate * 5
    const trailingBufferFrames = framerate * 1

    const clipsToMount = timeline.tracks.flatMap((track) =>
      track.clips.filter(
        (clip) =>
          playhead < clip.timeline_out + trailingBufferFrames &&
          playhead > clip.timeline_in - preloadBufferFrames,
      ),
    )

    // AUDIBILITY CHECK: Which ones actually need to be ready for sound RIGHT NOW
    const audibleClips = clipsToMount.filter(
      (clip) => playhead >= clip.timeline_in && playhead < clip.timeline_out,
    )

    const requiredIds = new Set(clipsToMount.map((c) => c.id))
    const currentAudibleIds = new Set(audibleClips.map((c) => c.id))

    // REMOVE CLIPS that are far away
    mountedClipIds.current.forEach((id) => {
      if (!requiredIds.has(id)) {
        audioEngine.removeTrack(id)
        mountedClipIds.current.delete(id)
        console.log(`[Orchestrator] Disposed distant track: ${id}`)
      }
    })

    // ADD CLIPS that are approaching
    clipsToMount.forEach(async (clip) => {
      if (
        !mountedClipIds.current.has(clip.id) &&
        !isInitializing.current.has(clip.id)
      ) {
        const asset = assets.find((a) => a.id === clip.asset_id)
        if (!asset) return

        isInitializing.current.add(clip.id)

        // Update ready state if we need this clip immediately
        if (currentAudibleIds.has(clip.id)) {
          setIsReady(false)
        }

        try {
          const isMp3 =
            asset.file_path.toLowerCase().endsWith('.mp3') ||
            asset.media_type === 'audio'

          const provider = isMp3
            ? new StandaloneAudioProvider(asset.file_path, audioCtx)
            : new MP4AudioProvider(asset.file_path)

          console.log(
            `[Orchestrator] Preloading track: ${clip.id} (${isMp3 ? 'MP3' : 'MP4'})`,
          )

          await audioEngine.addTrack(
            clip.id,
            provider,
            clip.timeline_in / framerate,
            clip.source_in / framerate,
          )

          const pipeline = audioEngine.getTrack(clip.id)
          if (pipeline) {
            const sourceTime =
              (playhead - clip.timeline_in + clip.source_in) / framerate
            pipeline.seek(sourceTime)
          }

          mountedClipIds.current.add(clip.id)
        } catch (e) {
          console.error(`[Orchestrator] Preload failed for ${clip.id}:`, e)
        } finally {
          isInitializing.current.delete(clip.id)

          // Re-check overall readiness
          const stillLoadingAudible = audibleClips.some((c) =>
            isInitializing.current.has(c.id),
          )
          setIsReady(!stillLoadingAudible)
        }
      }
    })

    // Update readiness based on currently audible clips
    const loadingAudible = audibleClips.some((c) =>
      isInitializing.current.has(c.id),
    )
    if (isReady === loadingAudible) {
      // If state needs flipping
      setIsReady(!loadingAudible)
    }
  }, [playhead, activeProject, assets, audioEngine, audioCtx, framerate])

  return { isReady }
}
