import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/timelineStore'
import { useProjectStore } from '../store/projectStore'
import { fpsToNumeric } from '../helpers/fps'

/**
 * usePlaybackLoop drives the frame-by-frame progression of the project.
 * It synchronizes the video engine and audio engine based on the hardware clock.
 */
export function usePlaybackLoop(
  videoEngine: any,
  audioEngine?: any,
  audioCtx?: AudioContext | null,
) {
  const isPlaying = useAppStore((state) => state.isPlaying)
  const setPlayhead = useAppStore((state) => state.setPlayhead)

  const activeProject = useProjectStore((state) => state.activeProject)
  const framerate = fpsToNumeric(activeProject?.framerate)

  const requestRef = useRef<number>(null)
  const lastActiveClipId = useRef<string | null>(null)

  // A/V Sync Refs
  const playbackStartTime = useRef<number>(0)
  const playbackStartPlayhead = useRef<number>(0)
  const playheadFloatRef = useRef<number>(0)
  const lastTickTime = useRef<number>(0)

  useEffect(() => {
    const tick = (now: number) => {
      if (!isPlaying) return

      if (audioCtx) {
        // Master clock derived from hardware audio context
        const elapsedSeconds = audioCtx.currentTime - playbackStartTime.current
        playheadFloatRef.current =
          playbackStartPlayhead.current + elapsedSeconds * framerate
      } else {
        // Fallback to high-precision performance clock
        const delta = (now - lastTickTime.current) / 1000
        playheadFloatRef.current += delta * framerate
      }

      lastTickTime.current = now

      const currentPlayhead = Math.floor(playheadFloatRef.current)

      // 1. UPDATE UI (Integer-based)
      if (currentPlayhead !== useAppStore.getState().playhead_position) {
        setPlayhead(currentPlayhead)
      }

      // 2. UPDATE VIDEO (High-precision every tick)
      const timeline = activeProject?.timeline_state
      const videoTrack = timeline?.tracks.find(
        (t: any) => t.track_type === 'video',
      )
      const activeVideoClip = videoTrack?.clips.find(
        (clip: any) =>
          playheadFloatRef.current >= clip.timeline_in &&
          playheadFloatRef.current < clip.timeline_out,
      )

      if (activeVideoClip && videoEngine) {
        // Use the high-precision float for the physical source time
        const sourceTime =
          (playheadFloatRef.current -
            activeVideoClip.timeline_in +
            activeVideoClip.source_in) /
          framerate

        if (activeVideoClip.id !== lastActiveClipId.current) {
          lastActiveClipId.current = activeVideoClip.id
          videoEngine.seekByTime(sourceTime)
        } else {
          videoEngine.displayAtTime(sourceTime)
        }
      } else {
        lastActiveClipId.current = null
      }

      // UPDATE AUDIO
      if (audioEngine) {
        audioEngine.decodeNextBatch(10) // Increase look-ahead depth to 10 samples per tick
      }

      requestRef.current = requestAnimationFrame(tick) as any
    }

    if (isPlaying) {
      const currentPos = useAppStore.getState().playhead_position
      playheadFloatRef.current = currentPos
      lastTickTime.current = performance.now()

      if (audioCtx) {
        playbackStartTime.current = audioCtx.currentTime
        playbackStartPlayhead.current = currentPos

        if (audioEngine) {
          // Sync all tracks to the new start point
          audioEngine.setPlaybackSync(
            playbackStartTime.current,
            playbackStartPlayhead.current,
            framerate,
          )
        }
      }

      requestRef.current = requestAnimationFrame(tick) as any
    } else if (requestRef.current) {
      if (audioEngine) {
        audioEngine.stop()
      }
      cancelAnimationFrame(requestRef.current)
    }

    return () => {
      if (audioEngine) {
        audioEngine.stop()
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [
    isPlaying,
    framerate,
    videoEngine,
    audioEngine,
    audioCtx,
    activeProject,
    setPlayhead,
  ])
}
