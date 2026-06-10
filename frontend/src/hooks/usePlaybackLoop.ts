import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/timelineStore'
import { getSourceFrameForPlayhead } from '../helpers/timeline'
import { useProjectStore } from '../store/projectStore'

export function usePlaybackLoop(
  videoEngine: any,
  audioEngine?: any,
  audioCtx?: AudioContext | null,
) {
  const isPlaying = useAppStore((state) => state.isPlaying)
  const framerate = useAppStore((state) => state.framerate)
  const setPlayhead = useAppStore((state) => state.setPlayhead)

  const activeProject = useProjectStore((state) => state.activeProject)

  const requestRef = useRef<number>(null)
  const lastActiveClipId = useRef<string | null>(null)

  // A/V Sync Refs
  const playbackStartTime = useRef<number>(0)
  const playbackStartPlayhead = useRef<number>(0)

  useEffect(() => {
    const tick = () => {
      if (!isPlaying) return

      let currentPlayhead = useAppStore.getState().playhead_position

      if (audioCtx) {
        // MATH SLAVE: The playhead is now a function of the hardware audio clock
        const elapsedSeconds = audioCtx.currentTime - playbackStartTime.current
        currentPlayhead =
          playbackStartPlayhead.current + Math.floor(elapsedSeconds * framerate)
      } else {
        // Fallback to RAF clock if no audio
        currentPlayhead += 1
      }

      if (currentPlayhead !== useAppStore.getState().playhead_position) {
        setPlayhead(currentPlayhead)

        const timeline = activeProject?.timeline_state
        const videoTrack = timeline?.tracks.find(
          (t: any) => t.track_type === 'video',
        )
        const activeClip = videoTrack?.clips.find(
          (clip: any) =>
            currentPlayhead >= clip.timeline_in &&
            currentPlayhead < clip.timeline_out,
        )

        if (activeClip && videoEngine) {
          const targetFrame = getSourceFrameForPlayhead(
            currentPlayhead,
            activeClip,
          )

          if (targetFrame !== null) {
            if (activeClip.id !== lastActiveClipId.current) {
              videoEngine.seekAndDisplay(targetFrame)

              // RE-SYNC AUDIO FOR NEW CLIP
              if (audioEngine) {
                const sourceTime = targetFrame / framerate
                audioEngine.setPlaybackSync(
                  audioCtx ? audioCtx.currentTime : performance.now() / 1000,
                  targetFrame,
                  framerate,
                )
                audioEngine.seekByTime(sourceTime)

                // Update the local sync refs so the loop stays consistent
                playbackStartTime.current = audioCtx
                  ? audioCtx.currentTime
                  : performance.now() / 1000
                playbackStartPlayhead.current = currentPlayhead
              }

              lastActiveClipId.current = activeClip.id
            } else {
              videoEngine.decodeNextFrame()
            }
          }
        } else {
          lastActiveClipId.current = null
        }

        // Also drive the audio engine if present
        if (audioEngine) {
          audioEngine.decodeNextBatch(5)
        }
      }

      requestRef.current = requestAnimationFrame(tick) as any
    }

    if (isPlaying) {
      const timeline = activeProject?.timeline_state
      const videoTrack = timeline?.tracks.find(
        (t: any) => t.track_type === 'video',
      )
      const currentPos = useAppStore.getState().playhead_position
      const activeClip = videoTrack?.clips.find(
        (clip: any) =>
          currentPos >= clip.timeline_in && currentPos < clip.timeline_out,
      )

      if (audioCtx) {
        playbackStartTime.current = audioCtx.currentTime
        playbackStartPlayhead.current = currentPos

        if (audioEngine) {
          const targetFrame = activeClip
            ? (getSourceFrameForPlayhead(currentPos, activeClip) ?? currentPos)
            : currentPos

          audioEngine.setPlaybackSync(
            playbackStartTime.current,
            targetFrame,
            framerate,
          )
          audioEngine.seekByTime(targetFrame / framerate)
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
