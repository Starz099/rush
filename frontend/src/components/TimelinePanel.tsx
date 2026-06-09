import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import {
  FilmStripIcon,
  SpeakerHighIcon,
  PlayIcon,
  PauseIcon,
} from '@phosphor-icons/react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'

// Constants for timeline scaling
const PIXELS_PER_SECOND = 20
const TICK_INTERVAL_SECONDS = 5 // Mark every 5 seconds

interface TimelineTrackProps {
  track: any
  framerate: number
}

const TimelineTrack = ({ track, framerate }: TimelineTrackProps) => {
  return (
    <div className="flex h-16 border-b border-white/5 bg-white/[0.02]">
      {/* Track Content */}
      <div className="relative flex-1 bg-black/20">
        {track.clips.map((clip: any) => (
          <div
            key={clip.id}
            className="absolute top-1 bottom-1 flex items-center justify-center rounded border border-blue-500/50 bg-blue-500/20 px-2 text-[9px] text-blue-200"
            style={{
              left: `${(clip.timeline_in / framerate) * PIXELS_PER_SECOND}px`,
              width: `${((clip.timeline_out - clip.timeline_in) / framerate) * PIXELS_PER_SECOND}px`,
            }}
          >
            {clip.id.slice(0, 4)}
          </div>
        ))}
      </div>
    </div>
  )
}

export const TimelinePanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject)
  const saveTimeline = useProjectStore((state) => state.saveTimeline)

  const isPlaying = useAppStore((state) => state.isPlaying)
  const togglePlayback = useAppStore((state) => state.togglePlayback)
  const playheadPosition = useAppStore((state) => state.playhead_position)
  const setPlayhead = useAppStore((state) => state.setPlayhead)
  const framerate = useAppStore((state) => state.framerate)

  const timelineContentRef = useRef<HTMLDivElement>(null)

  if (!activeProject) return null

  const timeline = activeProject.timeline_state

  // Calculate total duration in frames
  const allClips = timeline.tracks.flatMap((t: any) => t.clips)
  const maxFrames = allClips.reduce(
    (max: number, clip: any) => Math.max(max, clip.timeline_out),
    0,
  )

  const totalDurationSeconds = Math.max(maxFrames / framerate + 5, 30)
  const timelineWidthPx = totalDurationSeconds * PIXELS_PER_SECOND
  const numTicks = Math.ceil(totalDurationSeconds / TICK_INTERVAL_SECONDS) + 1

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineContentRef.current) return
    const rect = timelineContentRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < 0) return

    // Convert pixel X to time (seconds) then to frame
    const timeInSeconds = x / PIXELS_PER_SECOND
    const newFramePosition = Math.round(timeInSeconds * framerate)

    setPlayhead(newFramePosition)

    if (!isPlaying) {
      saveTimeline(activeProject.id, {
        ...timeline,
        playhead_position: newFramePosition,
      })
    }
  }

  // Format frames to HH:MM:SS:FF or MM:SS:FF
  const formatTime = (frame: number) => {
    const totalSeconds = Math.floor(frame / framerate)
    const f = frame % framerate
    const s = totalSeconds % 60
    const m = Math.floor(totalSeconds / 60) % 60

    return `${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}:${f.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex h-full flex-col bg-[#111] select-none">
      {/* Timeline Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/5 px-3">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Timeline
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 hover:bg-white/10"
            onClick={togglePlayback}
          >
            {isPlaying ? (
              <PauseIcon weight="fill" className="size-3 text-white" />
            ) : (
              <PlayIcon weight="fill" className="size-3 text-white" />
            )}
          </Button>
        </div>

        <div className="text-muted-foreground rounded bg-white/5 px-2 py-0.5 font-mono text-[10px]">
          {formatTime(playheadPosition)}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Fixed Track Headers */}
        <div className="z-20 flex w-40 shrink-0 flex-col border-r border-white/5 bg-[#111]">
          {/* Header Spacer for Timebar */}
          <div className="h-6 border-b border-white/5 bg-white/[0.02]" />

          {timeline.tracks.map((track: any) => (
            <div
              key={track.id}
              className="flex h-16 items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3"
            >
              {track.track_type === 'video' ? (
                <FilmStripIcon className="size-4 text-blue-400" />
              ) : (
                <SpeakerHighIcon className="size-4 text-green-400" />
              )}
              <span className="truncate text-[11px] font-medium">
                {track.name}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Tracks Content */}
        <ScrollArea className="flex-1 overflow-hidden" dir="ltr">
          <div
            className="relative flex min-h-full flex-col"
            ref={timelineContentRef}
            onClick={handleTimelineClick}
            style={{ width: `${timelineWidthPx}px` }}
          >
            {/* Timebar/Ruler */}
            <div className="relative h-6 border-b border-white/5 bg-white/[0.01]">
              {/* Simple markers every few seconds */}
              {Array.from({ length: numTicks }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-white/10 pt-1 pl-1 text-[8px] text-white/20"
                  style={{
                    left: `${i * TICK_INTERVAL_SECONDS * PIXELS_PER_SECOND}px`,
                  }}
                >
                  {i * TICK_INTERVAL_SECONDS}s
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-[2px] bg-red-500"
              style={{
                left: `${(playheadPosition / framerate) * PIXELS_PER_SECOND}px`,
              }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 border-t-[8px] border-r-[6px] border-l-[6px] border-t-red-500 border-r-transparent border-l-transparent" />
            </div>

            {timeline.tracks.map((track: any) => (
              <TimelineTrack
                key={track.id}
                track={track}
                framerate={framerate}
              />
            ))}

            {timeline.tracks.length === 0 && (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-white/10">
                <span className="text-xs">No tracks found.</span>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}
