import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import { usePlaybackLoop } from '@/hooks/usePlaybackLoop'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon, FilmStripIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { VideoDemuxer } from '../engine/Demuxer'
import { WebGPURenderer } from '../engine/Renderer'

export const PreviewPanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [demuxer, setDemuxer] = useState<VideoDemuxer | null>(null)

  const playheadPosition = useAppStore((state) => state.playhead_position)

  const timeline = activeProject?.timeline_state
  const videoTrack = timeline?.tracks.find((t: any) => t.track_type === 'video')

  const activeClip = videoTrack?.clips.find(
    (clip: any) =>
      playheadPosition >= clip.timeline_in &&
      playheadPosition < clip.timeline_out,
  )

  const activeAsset = activeClip
    ? assets.find((a) => a.id === activeClip.asset_id)
    : null

  const previewWidth = activeProject?.viewport_width ?? 1920
  const previewHeight = activeProject?.viewport_height ?? 1080

  // Attach the engine to the metronome clock
  usePlaybackLoop(demuxer)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeAsset || activeAsset.media_type !== 'video') {
      demuxer?.dispose()
      setDemuxer(null)
      return
    }

    let cancelled = false

    const initEngine = async () => {
      try {
        canvas.width = previewWidth
        canvas.height = previewHeight

        const renderer = new WebGPURenderer(canvas)
        await renderer.initialize()

        if (cancelled) return

        const newDemuxer = new VideoDemuxer(activeAsset.file_path, renderer)
        await newDemuxer.initialize()

        if (cancelled) {
          newDemuxer.dispose()
          return
        }

        setDemuxer(newDemuxer)
      } catch (error) {
        console.error('Failed to initialize WebGPU preview:', error)
      }
    }

    initEngine()

    return () => {
      cancelled = true
    }
  }, [
    activeAsset?.file_path,
    activeAsset?.id,
    activeAsset?.media_type,
    previewWidth,
    previewHeight,
  ])

  // Cleanup demuxer on unmount
  useEffect(() => {
    return () => {
      demuxer?.dispose()
    }
  }, [demuxer])

  if (!activeProject) return null

  return (
    <div className="flex h-full flex-col bg-black/40 p-4">
      <div className="relative mx-auto flex aspect-video w-full max-w-[90%] flex-1 items-center justify-center overflow-hidden border border-white/5 bg-black text-white/20 shadow-2xl">
        {activeAsset ? (
          activeAsset.media_type === 'video' ? (
            <canvas
              ref={canvasRef}
              key={activeAsset.id}
              className="h-full w-full object-contain"
              width={previewWidth}
              height={previewHeight}
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
