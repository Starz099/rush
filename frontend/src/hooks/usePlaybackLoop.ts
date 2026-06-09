import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/timelineStore'
import { getSourceFrameForPlayhead } from '../helpers/timeline'
import { useProjectStore } from '../store/projectStore'

export function usePlaybackLoop(videoEngine: any) {
  const isPlaying = useAppStore((state) => state.isPlaying)
  const framerate = useAppStore((state) => state.framerate)
  const setPlayhead = useAppStore((state) => state.setPlayhead)

  // Use the active project from projectStore to get tracks/clips
  const activeProject = useProjectStore((state) => state.activeProject)

  // We use refs to avoid re-triggering the useEffect on every frame
  const requestRef = useRef<number>(null)
  const lastTickTime = useRef<number>(performance.now())
  const frameInterval = 1000 / framerate // e.g., 16.66ms for 60fps

  useEffect(() => {
    const tick = (currentTime: number) => {
      if (!isPlaying) return

      // Calculate how much time passed since the last render
      const deltaTime = currentTime - lastTickTime.current

      // If enough time has passed to render the next frame (e.g., 16.6ms)
      if (deltaTime >= frameInterval) {
        // 1. Advance the global Zustand playhead
        const nextPlayhead = useAppStore.getState().playhead_position + 1
        setPlayhead(nextPlayhead)

        // 2. Grab the latest state for math
        const timeline = activeProject?.timeline_state
        const videoTrack = timeline?.tracks.find(
          (t: any) => t.track_type === 'video',
        )
        const activeClip = videoTrack?.clips.find(
          (clip: any) =>
            nextPlayhead >= clip.timeline_in &&
            nextPlayhead < clip.timeline_out,
        )

        if (activeClip && videoEngine) {
          // 3. Calculate the math (Verify we should still be playing this clip)
          const targetFrame = getSourceFrameForPlayhead(
            nextPlayhead,
            activeClip,
          )

          if (targetFrame !== null) {
            // 4. Tell your WebCodecs engine to decode & draw this specific frame!
            // NOTE: In V1, we assume sequential decoding for playback.
            videoEngine.decodeNextFrame()
          }
        }

        // Reset the timer for the next frame, accounting for any drift
        lastTickTime.current = currentTime - (deltaTime % frameInterval)
      }

      // Loop again
      requestRef.current = requestAnimationFrame(tick)
    }

    if (isPlaying) {
      lastTickTime.current = performance.now()
      requestRef.current = requestAnimationFrame(tick)
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [isPlaying, framerate, videoEngine, activeProject, setPlayhead])
}
