import { useProjectStore } from '@/store/projectStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import {
  FilmStripIcon,
  SpeakerHighIcon,
  PlayIcon,
  PauseIcon,
} from '@phosphor-icons/react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const MS_PER_PIXEL = 40
const TICK_INTERVAL_MS = 5000

interface TimelineTrackProps {
  track: any
}

const TimelineTrack = ({ track }: TimelineTrackProps) => {
  return (
    <div className="flex h-16 border-b border-white/5 bg-white/[0.02]">
      {/* Track Content */}
      <div className="relative flex-1 bg-black/20">
        {track.clips.map((clip: any) => (
          <div
            key={clip.id}
            className="absolute top-1 bottom-1 flex items-center justify-center rounded border border-blue-500/50 bg-blue-500/20 px-2 text-[9px] text-blue-200"
            style={{
              left: `${clip.timeline_in / MS_PER_PIXEL}px`,
              width: `${(clip.timeline_out - clip.timeline_in) / MS_PER_PIXEL}px`,
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
  const setPlayheadOnly = useProjectStore((state) => state.setPlayheadOnly)

  const isPlaying = useWorkspaceStore((state) => state.isPlaying)
  const togglePlaying = useWorkspaceStore((state) => state.togglePlaying)

  const timelineContentRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number>(null)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const animate = (time: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time
      }

      const deltaTime = time - lastTimeRef.current
      lastTimeRef.current = time

      const state = useProjectStore.getState()
      const project = state.activeProject

      if (project && isPlaying) {
        // Find the end of the timeline (max timeline_out across all tracks)
        const allClips = project.timeline_state.tracks.flatMap(
          (t: any) => t.clips,
        )
        const maxTime = allClips.reduce(
          (max: number, clip: any) => Math.max(max, clip.timeline_out),
          0,
        )

        const currentPos = project.timeline_state.playhead_position
        const newPosition = currentPos + deltaTime

        if (newPosition >= maxTime && maxTime > 0) {
          setPlayheadOnly(maxTime)
          useWorkspaceStore.getState().setIsPlaying(false)
        } else {
          setPlayheadOnly(Math.round(newPosition))
          requestRef.current = requestAnimationFrame(animate)
        }
      }
    }

    if (isPlaying) {
      lastTimeRef.current = 0
      requestRef.current = requestAnimationFrame(animate)
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      if (activeProject) {
        saveTimeline(activeProject.id, activeProject.timeline_state)
      }
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [isPlaying, setPlayheadOnly, saveTimeline])

  if (!activeProject) return null

  const timeline = activeProject.timeline_state

  // Calculate total duration for dynamic width
  const allClips = timeline.tracks.flatMap((t: any) => t.clips)
  const maxTime = allClips.reduce(
    (max: number, clip: any) => Math.max(max, clip.timeline_out),
    0,
  )
  // Ensure at least 30 seconds or enough to fit all clips
  const totalDurationMs = Math.max(maxTime + 5000, 30000)
  const timelineWidthPx = totalDurationMs / MS_PER_PIXEL
  const numTicks = Math.ceil(totalDurationMs / TICK_INTERVAL_MS) + 1

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineContentRef.current) return
    const rect = timelineContentRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < 0) return

    const newPosition = Math.round(x * MS_PER_PIXEL)
    setPlayheadOnly(newPosition)

    if (!isPlaying) {
      saveTimeline(activeProject.id, {
        ...timeline,
        playhead_position: newPosition,
      })
    }
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
            onClick={togglePlaying}
          >
            {isPlaying ? (
              <PauseIcon weight="fill" className="size-3 text-white" />
            ) : (
              <PlayIcon weight="fill" className="size-3 text-white" />
            )}
          </Button>
        </div>

        <div className="text-muted-foreground rounded bg-white/5 px-2 py-0.5 font-mono text-[10px]">
          {Math.floor(timeline.playhead_position / 1000)}s{' '}
          <span className="opacity-30">
            {(timeline.playhead_position % 1000).toString().padStart(3, '0')}ms
          </span>
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
                  style={{ left: `${(i * TICK_INTERVAL_MS) / MS_PER_PIXEL}px` }}
                >
                  {Math.floor((i * TICK_INTERVAL_MS) / 1000)}s
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-[2px] bg-red-500"
              style={{ left: `${timeline.playhead_position / MS_PER_PIXEL}px` }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 border-t-[8px] border-r-[6px] border-l-[6px] border-t-red-500 border-r-transparent border-l-transparent" />
            </div>

            {timeline.tracks.map((track: any) => (
              <TimelineTrack key={track.id} track={track} />
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
