import type { Clip } from '@/api/bindings'
import { PIXELS_PER_SECOND, SNAP_THRESHOLD_PX } from '@/constants/timeline'
import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useState } from 'react'
import { getTrackUIConfig } from '@/constants/trackConfig'
interface TimelineTrackProps {
  track: any
  framerate: number
}

export const TimelineTrack = ({ track, framerate }: TimelineTrackProps) => {
  const config = getTrackUIConfig(track)
  const bgColor = config?.bgClass || 'bg-white/5'
  const borderColor = config?.borderClass || 'border-white/10'
  const textColor = config?.textClass || 'text-white/70'

  const snapThresholdFrames =
    (SNAP_THRESHOLD_PX / PIXELS_PER_SECOND) * framerate
  const [isDragging, setIsDragging] = useState(false)

  const { selectedClipId, setClipSelection, activeTool } = useWorkspaceStore()
  const setPlayhead = useAppStore((state) => state.setPlayhead)
  const splitClip = useProjectStore((state) => state.splitClip)
  const trimClip = useProjectStore((state) => state.trimClip)

  const handleClipMouseDown = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation()

    if (activeTool === 'split') {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickTimeSeconds = clickX / PIXELS_PER_SECOND
      const clickFrames = Math.round(clickTimeSeconds * framerate)
      const targetSplitFrame = clip.timeline_in + clickFrames

      if (
        targetSplitFrame > clip.timeline_in &&
        targetSplitFrame < clip.timeline_out
      ) {
        void splitClip(track.id, clip.id, targetSplitFrame)
      }
      return
    }

    // Default drag-move logic
    setClipSelection(track.id, clip.id)
    setPlayhead(clip.timeline_in)
    setIsDragging(true)

    const startPixelX = e.clientX
    const startTimelineIn = clip.timeline_in

    // GATHER SNAP POINTS (Edges of all other clips + Playhead + Start)
    const project = useProjectStore.getState().activeProject
    const playheadPosition = useAppStore.getState().playhead_position

    const snapPoints =
      project?.timeline_state.tracks.flatMap((t: any) =>
        t.clips
          .filter((c: Clip) => c.id !== clip.id)
          .flatMap((c: Clip) => [c.timeline_in, c.timeline_out]),
      ) || []

    snapPoints.push(0, playheadPosition)

    const handleMouseMove = async (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPixelX
      const deltaFrames = Math.round((deltaX / PIXELS_PER_SECOND) * framerate)

      // Get latest state to avoid stale closure issues
      const project = useProjectStore.getState().activeProject
      if (!project) return

      const latestTrack = project.timeline_state.tracks.find(
        (t) => t.id === track.id,
      )
      if (!latestTrack) return

      const latestClip = latestTrack.clips.find((c) => c.id === clip.id)
      if (!latestClip) return

      const duration = latestClip.timeline_out - latestClip.timeline_in
      const rawTimelineIn = Math.max(0, startTimelineIn + deltaFrames)

      const rawTimelineOut = rawTimelineIn + duration
      let finalTimelineIn = rawTimelineIn

      // Check if head snaps
      const headSnap = snapPoints.find(
        (p) => Math.abs(rawTimelineIn - p) <= snapThresholdFrames,
      )
      if (headSnap !== undefined) {
        finalTimelineIn = headSnap
      } else {
        // Check if tail snaps
        const tailSnap = snapPoints.find(
          (p) => Math.abs(rawTimelineOut - p) <= snapThresholdFrames,
        )
        if (tailSnap !== undefined) {
          finalTimelineIn = tailSnap - duration
        }
      }

      // Use updateClipProperties which already handles Sync Locking
      await useProjectStore.getState().updateClipProperties(
        track.id,
        clip.id,
        { timeline_in: finalTimelineIn },
        false, // Don't persist on every move
      )
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setIsDragging(false)

      // After dragging, persist the new timeline state
      const project = useProjectStore.getState().activeProject
      if (project) {
        useProjectStore.getState().saveTimeline(project.id, {
          ...project.timeline_state,
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleTrimMouseDown = (
    e: React.MouseEvent,
    clip: Clip,
    edge: 'left' | 'right',
  ) => {
    e.stopPropagation()
    e.preventDefault()

    const startPixelX = e.clientX
    const startFrame = edge === 'left' ? clip.timeline_in : clip.timeline_out

    const handleMouseMove = async (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startPixelX
      const deltaFrames = Math.round((deltaX / PIXELS_PER_SECOND) * framerate)
      const newFrameValue = startFrame + deltaFrames

      await trimClip(track.id, clip.id, edge, newFrameValue)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const getCursorClass = () => {
    if (activeTool === 'split') return 'cursor-cell'
    if (activeTool === 'trim') return 'cursor-ew-resize'
    return 'cursor-grab active:cursor-grabbing'
  }

  return (
    <div className="flex h-16 border-b border-white/5 bg-white/[0.02]">
      {/* Track Content */}
      <div className="relative flex-1 bg-black/20">
        {track.clips.map((clip: Clip) => {
          const isSelected = selectedClipId === clip.id
          return (
            <div
              key={clip.id}
              onMouseDown={(e) => handleClipMouseDown(e, clip)}
              onClick={(e) => e.stopPropagation()}
              className={`group/clip absolute top-1 bottom-1 flex items-center justify-center rounded border ${getCursorClass()} ${
                isSelected
                  ? 'z-10 border-blue-400 bg-blue-500/40 ring-1 ring-blue-400/50'
                  : `${borderColor} ${bgColor} hover:border-white/20`
              } ${isDragging && isSelected ? '' : 'transition-all'} px-2 text-[9px] font-medium ${isSelected ? 'text-white' : textColor}`}
              style={{
                left: `${(clip.timeline_in / framerate) * PIXELS_PER_SECOND}px`,
                width: `${((clip.timeline_out - clip.timeline_in) / framerate) * PIXELS_PER_SECOND}px`,
              }}
            >
              {/* Left Trim Handle */}
              <div
                className="absolute top-0 bottom-0 left-0 z-20 w-2 cursor-ew-resize bg-blue-500/40 opacity-0 transition-opacity group-hover/clip:opacity-100"
                onMouseDown={(e) => handleTrimMouseDown(e, clip, 'left')}
              />

              <span className="truncate">
                {config?.type === 'effects'
                  ? clip.speed_factor !== undefined &&
                    clip.speed_factor !== null
                    ? `Speed Effect (${clip.speed_factor}x)`
                    : 'Zoom Effect'
                  : clip.id.slice(0, 8)}
              </span>

              {/* Right Trim Handle */}
              <div
                className="absolute top-0 right-0 bottom-0 z-20 w-2 cursor-ew-resize bg-blue-500/40 opacity-0 transition-opacity group-hover/clip:opacity-100"
                onMouseDown={(e) => handleTrimMouseDown(e, clip, 'right')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
