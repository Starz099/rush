import { useProjectStore } from '@/store/projectStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon, FilmStripIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'

export const PreviewPanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const isPlaying = useWorkspaceStore((state) => state.isPlaying)
  const videoRef = useRef<HTMLVideoElement>(null)

  if (!activeProject) return null

  const timeline = activeProject.timeline_state
  const videoTrack = timeline.tracks.find((t: any) => t.track_type === 'video')

  // Find clip at playhead
  const activeClip = videoTrack?.clips.find(
    (clip: any) =>
      timeline.playhead_position >= clip.timeline_in &&
      timeline.playhead_position < clip.timeline_out,
  )

  const activeAsset = activeClip
    ? assets.find((a) => a.id === activeClip.asset_id)
    : null

  useEffect(() => {
    if (!videoRef.current || !activeClip) return

    const video = videoRef.current
    const offset = timeline.playhead_position - activeClip.timeline_in
    const targetSourceTime = (activeClip.source_in + offset) / 1000 // ms to s

    // Handle Play/Pause
    if (isPlaying) {
      if (video.paused) {
        // Sync time before playing to ensure we start at the right frame
        video.currentTime = targetSourceTime
        video.play().catch((e) => console.error('Playback failed', e))
      } else {
        // While playing, only force seek if we get too far out of sync (> 100ms)
        const diff = Math.abs(video.currentTime - targetSourceTime)
        if (diff > 0.1) {
          video.currentTime = targetSourceTime
        }
      }
    } else {
      if (!video.paused) {
        video.pause()
      }
      // Always sync time when paused/scrubbing
      video.currentTime = targetSourceTime
    }
  }, [timeline.playhead_position, activeClip, isPlaying])

  return (
    <div className="flex h-full items-center justify-center bg-black/40 p-4">
      <div className="relative flex aspect-video w-full max-w-[90%] items-center justify-center overflow-hidden border border-white/5 bg-black text-white/20 shadow-2xl">
        {activeAsset ? (
          activeAsset.media_type === 'video' ? (
            <video
              ref={videoRef}
              key={activeAsset.id}
              src={convertFileSrc(activeAsset.file_path)}
              className="h-full w-full object-contain"
              muted
              playsInline
            />
          ) : activeAsset.media_type === 'image' ? (
            <img
              src={convertFileSrc(activeAsset.file_path)}
              alt={activeAsset.name}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-center">
              <FileIcon className="mx-auto mb-2 size-12 opacity-20" />
              <p className="text-xs">Preview not available</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FilmStripIcon className="size-12 opacity-10" />
            <span className="text-[10px] font-medium tracking-widest uppercase opacity-20">
              No Clip at Playhead
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
