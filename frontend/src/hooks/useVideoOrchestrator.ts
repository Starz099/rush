import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/timelineStore'
import { useProjectStore } from '../store/projectStore'
import type { VideoEngine } from '../engine/VideoEngine'
import { fpsToNumeric } from '../helpers/fps'

/**
 * useVideoOrchestrator manages the lifecycle of video clips in the VideoEngine.
 * It looks ahead on the timeline and pre-warms upcoming clips to ensure zero-latency transitions.
 */
export function useVideoOrchestrator(videoEngine: VideoEngine | null) {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const playhead = useAppStore((state) => state.playhead_position)
  const framerate = fpsToNumeric(activeProject?.framerate)

  // Track which clip IDs are currently loaded or being loaded
  const mountedClipIds = useRef<Set<string>>(new Set())
  const isInitializing = useRef<Set<string>>(new Set())
  const failedClipIds = useRef<Set<string>>(new Set())

  // Track readiness for the UI (optional, but good for showing spinners)
  const [isReady, setIsReady] = useState(true)

  useEffect(() => {
    if (!videoEngine || !activeProject) return

    const timeline = activeProject.timeline_state

    // PRELOAD LOGIC: Look 5 seconds ahead and 1 second behind
    const preloadBufferFrames = framerate * 5
    const trailingBufferFrames = framerate * 1

    // Find all video clips within the buffer window
    const videoTracks = timeline.tracks.filter(
      (t: any) => t.track_type === 'video',
    )
    const clipsToMount = videoTracks.flatMap((track: any) =>
      track.clips.filter(
        (clip: any) =>
          playhead < clip.timeline_out + trailingBufferFrames &&
          playhead > clip.timeline_in - preloadBufferFrames &&
          !failedClipIds.current.has(clip.id),
      ),
    )

    // Check which clips are actually visible RIGHT NOW (to determine readiness)
    const activeClips = clipsToMount.filter(
      (clip: any) =>
        playhead >= clip.timeline_in && playhead < clip.timeline_out,
    )

    const requiredIds = new Set(clipsToMount.map((c: any) => c.id))
    const currentActiveIds = new Set(activeClips.map((c: any) => c.id))

    // 1. REMOVE CLIPS that are far away
    mountedClipIds.current.forEach((id) => {
      if (!requiredIds.has(id)) {
        console.log(
          `[VideoOrchestrator] Disposing clip ${id}. Playhead: ${playhead}. Required IDs:`,
          Array.from(requiredIds),
        )
        videoEngine.removeClip(id)
        mountedClipIds.current.delete(id)
      }
    })

    // 2. ADD CLIPS that are approaching
    clipsToMount.forEach(async (clip: any) => {
      if (
        !mountedClipIds.current.has(clip.id) &&
        !isInitializing.current.has(clip.id)
      ) {
        const asset = assets.find((a) => a.id === clip.asset_id)
        if (!asset) return

        isInitializing.current.add(clip.id)

        // If we need this clip immediately and it's not ready, signal not ready
        if (currentActiveIds.has(clip.id)) {
          setIsReady(false)
        }

        try {
          console.log(`[VideoOrchestrator] Preloading video clip: ${clip.id}`)

          // Add to engine (this handles initialization)
          await videoEngine.addClip(clip.id, asset.file_path)

          // PRE-SEEK: Get the decoder ready at the start of the clip or current playhead
          const sourceTime =
            (Math.max(playhead, clip.timeline_in) -
              clip.timeline_in +
              clip.source_in) /
            framerate

          await videoEngine.seekByTime(clip.id, sourceTime)

          mountedClipIds.current.add(clip.id)
        } catch (e) {
          console.error(`[VideoOrchestrator] Preload failed for ${clip.id}:`, e)
          failedClipIds.current.add(clip.id)
        } finally {
          isInitializing.current.delete(clip.id)

          // Re-check overall readiness
          const stillLoadingActive = activeClips.some((c: any) =>
            isInitializing.current.has(c.id),
          )
          setIsReady(!stillLoadingActive)
        }
      }
    })

    // Simple state synchronization for readiness
    const loadingActive = activeClips.some((c: any) =>
      isInitializing.current.has(c.id),
    )
    if (isReady === loadingActive) {
      setIsReady(!loadingActive)
    }
  }, [playhead, activeProject, assets, videoEngine, framerate])

  return { isReady }
}
