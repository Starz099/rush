import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/timelineStore'
import { getSourceFrameForPlayhead } from '../helpers/timeline'
import { useProjectStore } from '../store/projectStore'

export function usePlaybackLoop(videoEngine: any) {
  const isPlaying = useAppStore((state) => state.isPlaying)
  const framerate = useAppStore((state) => state.framerate)
  const setPlayhead = useAppStore((state) => state.setPlayhead)

  const activeProject = useProjectStore((state) => state.activeProject)

  const requestRef = useRef<number>(null)
  const lastTickTime = useRef<number>(performance.now())
  const lastActiveClipId = useRef<string | null>(null)
  const frameInterval = 1000 / framerate // e.g., 16.66ms for 60fps

  useEffect(() => {
    const tick = (currentTime: number) => {
      if (!isPlaying) return

      const deltaTime = currentTime - lastTickTime.current

      if (deltaTime >= frameInterval) {
        const nextPlayhead = useAppStore.getState().playhead_position + 1
        setPlayhead(nextPlayhead)

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
          const targetFrame = getSourceFrameForPlayhead(
            nextPlayhead,
            activeClip,
          )

          if (targetFrame !== null) {
            // when clips switch, we need to do a seek to the correct frame. If we're on the same clip, we can just decode the next frame for smoother playback.
            if (activeClip.id !== lastActiveClipId.current) {
              videoEngine.seekAndDisplay(targetFrame)
              lastActiveClipId.current = activeClip.id
            } else {
              videoEngine.decodeNextFrame()
            }
          }
        } else {
          lastActiveClipId.current = null
        }

        lastTickTime.current = currentTime - (deltaTime % frameInterval)
      }

      requestRef.current = requestAnimationFrame(tick) as any
    }

    if (isPlaying) {
      lastTickTime.current = performance.now()
      requestRef.current = requestAnimationFrame(tick) as any
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current)
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [isPlaying, framerate, videoEngine, activeProject, setPlayhead])
}
