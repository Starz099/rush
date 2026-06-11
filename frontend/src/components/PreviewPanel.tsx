import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import { usePlaybackLoop } from '@/hooks/usePlaybackLoop'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon, FilmStripIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { VideoDemuxer } from '../engine/Demuxer'
import { WebGPURenderer } from '../engine/Renderer'
import { AudioEngine } from '../engine/AudioEngine'
import { useAudioOrchestrator } from '@/hooks/useAudioOrchestrator'
import { fpsToNumeric } from '@/helpers/fps'

export const PreviewPanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Engine Refs
  const demuxerRef = useRef<VideoDemuxer | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)

  const [demuxer, setDemuxer] = useState<VideoDemuxer | null>(null)
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null)
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  const isPlaying = useAppStore((state) => state.isPlaying)
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
  const projectFps = fpsToNumeric(activeProject?.framerate)

  // Initialize Audio Engine once on mount
  useEffect(() => {
    if (!audioCtx) {
      const ctx = new AudioContext({ sampleRate: 48000 })
      setAudioCtx(ctx)

      const engine = new AudioEngine(ctx)
      audioEngineRef.current = engine
      setAudioEngine(engine)
    }

    return () => {
      audioEngineRef.current?.dispose()
    }
  }, [])

  // Attach the engine to the playback loop
  usePlaybackLoop(demuxer, audioEngine, audioCtx)

  // Attach the Orchestrator to manage tracks
  useAudioOrchestrator(audioEngine, audioCtx)

  // Resume AudioContext on user interaction (Play)
  useEffect(() => {
    if (isPlaying && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  }, [isPlaying, audioCtx])

  // Scrubbing logic (Sync when NOT playing)
  useEffect(() => {
    if (!isPlaying && activeClip) {
      const sourceTime =
        (playheadPosition - activeClip.timeline_in + activeClip.source_in) /
        projectFps

      if (demuxer) {
        demuxer.seekByTime(sourceTime)
      }

      if (audioEngine) {
        // Global seek for scrubbing
        audioEngine.seekByTime(sourceTime)
      }
    }
  }, [
    playheadPosition,
    isPlaying,
    demuxer,
    audioEngine,
    activeClip,
    projectFps,
  ])

  // Video Demuxer Lifecycle
  useEffect(() => {
    const canvas = canvasRef.current

    const cleanupDemuxer = () => {
      demuxerRef.current?.dispose()
      demuxerRef.current = null
      setDemuxer(null)
    }

    if (!canvas || !activeAsset || activeAsset.media_type !== 'video') {
      cleanupDemuxer()
      return
    }

    let cancelled = false

    const initVideo = async () => {
      try {
        setIsInitializing(true)
        cleanupDemuxer()

        canvas.width = previewWidth
        canvas.height = previewHeight

        const renderer = new WebGPURenderer(canvas)
        await renderer.initialize()

        if (cancelled) {
          renderer.dispose()
          return
        }

        const newDemuxer = new VideoDemuxer(activeAsset.file_path, renderer)
        await newDemuxer.initialize()

        if (cancelled) {
          newDemuxer.dispose()
          return
        }

        // PRE-SEEK demuxer to current playhead
        if (activeClip) {
          const sourceTime =
            (playheadPosition - activeClip.timeline_in + activeClip.source_in) /
            projectFps
          await newDemuxer.seekByTime(sourceTime)
        }

        demuxerRef.current = newDemuxer
        setDemuxer(newDemuxer)
      } catch (error) {
        console.error('Failed to initialize video engine:', error)
      } finally {
        if (!cancelled) {
          setIsInitializing(false)
        }
      }
    }

    initVideo()

    return () => {
      cancelled = true
    }
  }, [
    activeAsset?.file_path,
    activeAsset?.id,
    activeAsset?.media_type,
    previewWidth,
    previewHeight,
    projectFps,
  ])

  if (!activeProject) return null

  return (
    <div className="flex h-full flex-col bg-black/40 p-4">
      <div className="relative mx-auto flex aspect-video w-full max-w-[90%] flex-1 items-center justify-center overflow-hidden border border-white/5 bg-black text-white/20 shadow-2xl">
        {isInitializing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
              <span className="text-[10px] font-medium tracking-widest uppercase opacity-50">
                Initializing...
              </span>
            </div>
          </div>
        )}
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
