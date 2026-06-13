import type { Clip } from '@/api/bindings'
import { PIXELS_PER_SECOND, SNAP_THRESHOLD_PX } from '@/constants/timeline'
import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useState } from 'react'
interface TimelineTrackProps {
  track: any
  framerate: number
}

export const TimelineTrack = ({ track, framerate }: TimelineTrackProps) => {
  const isVideo = track.track_type === 'video'
  const bgColor = isVideo ? 'bg-blue-500/20' : 'bg-green-500/20'
  const borderColor = isVideo ? 'border-blue-500/40' : 'border-green-500/40'
  const textColor = isVideo ? 'text-blue-200/70' : 'text-green-200/70'

  const snapThresholdFrames =
    (SNAP_THRESHOLD_PX / PIXELS_PER_SECOND) * framerate
  const [isDragging, setIsDragging] = useState(false)

  const { selectedClipId, setClipSelection } = useWorkspaceStore()
  const updateClipProperties = useProjectStore(
    (state) => state.updateClipProperties,
  )
  const setPlayhead = useAppStore((state) => state.setPlayhead)

  const handleMouseDown = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation()

    setClipSelection(track.id, clip.id)
    setPlayhead(clip.timeline_in)
    setIsDragging(true)

    const startPixelX = e.clientX
    const startTimelineIn = clip.timeline_in
    const duration = clip.timeline_out - clip.timeline_in

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

      const rawTimelineIn = Math.max(0, startTimelineIn + deltaFrames)
      const rawTimelineOut = rawTimelineIn + duration

      let finalTimelineIn = rawTimelineIn

      // APPLY SNAPPING
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

      await updateClipProperties(
        track.id,
        clip.id,
        { timeline_in: finalTimelineIn },
        false,
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
  return (
    <div className="flex h-16 border-b border-white/5 bg-white/[0.02]">
      {/* Track Content */}
      <div className="relative flex-1 bg-black/20">
        {track.clips.map((clip: Clip) => {
          const isSelected = selectedClipId === clip.id
          return (
            <div
              key={clip.id}
              onMouseDown={(e) => handleMouseDown(e, clip)}
              onClick={(e) => e.stopPropagation()}
              className={`absolute top-1 bottom-1 flex cursor-grab items-center justify-center rounded border active:cursor-grabbing ${
                isSelected
                  ? 'z-10 border-blue-400 bg-blue-500/40 ring-1 ring-blue-400/50'
                  : `${borderColor} ${bgColor} hover:border-white/20`
              } ${isDragging && isSelected ? '' : 'transition-all'} px-2 text-[9px] font-medium ${isSelected ? 'text-white' : textColor}`}
              style={{
                left: `${(clip.timeline_in / framerate) * PIXELS_PER_SECOND}px`,
                width: `${((clip.timeline_out - clip.timeline_in) / framerate) * PIXELS_PER_SECOND}px`,
              }}
            >
              <span className="truncate">{clip.id.slice(0, 8)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
