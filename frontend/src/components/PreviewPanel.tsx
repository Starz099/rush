import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import { usePlaybackLoop } from '@/hooks/usePlaybackLoop'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon, FilmStripIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { VideoDemuxer } from '../engine/Demuxer'
import { WebGPURenderer } from '../engine/Renderer'
import { AudioEngine } from '../engine/AudioEngine'
import { MP4AudioProvider } from '@/engine/providers/MP4AudioProvider'

export const PreviewPanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Use Refs for engines to ensure we can dispose them IMMEDIATELY
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

  // Attach the engine to the metronome clock
  usePlaybackLoop(demuxer, audioEngine, audioCtx)

  // Initialize AudioContext on mount
  useEffect(() => {
    if (!audioCtx) {
      const ctx = new AudioContext({ sampleRate: 48000 })
      setAudioCtx(ctx)
    }
  }, [audioCtx])

  // Resume AudioContext on play
  useEffect(() => {
    if (isPlaying && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  }, [isPlaying, audioCtx])

  useEffect(() => {
    if (!isPlaying && activeClip) {
      const targetFrame =
        playheadPosition - activeClip.timeline_in + activeClip.source_in

      if (demuxer) {
        demuxer.seekAndDisplay(targetFrame)
      }

      if (audioEngine) {
        audioEngine.seekByTime(targetFrame / (activeProject?.framerate || 30))
      }
    }
  }, [
    playheadPosition,
    isPlaying,
    demuxer,
    audioEngine,
    activeClip,
    activeProject?.framerate,
  ])

  useEffect(() => {
    const canvas = canvasRef.current

    // Cleanup helper
    const cleanupEngines = () => {
      demuxerRef.current?.dispose()
      audioEngineRef.current?.dispose()
      demuxerRef.current = null
      audioEngineRef.current = null
      setDemuxer(null)
      setAudioEngine(null)
    }

    if (!canvas || !activeAsset || activeAsset.media_type !== 'video') {
      cleanupEngines()
      return
    }

    let cancelled = false

    const initEngine = async () => {
      try {
        setIsInitializing(true)
        // 1. DISPOSE OLD ENGINES IMMEDIATELY before initializing new ones
        cleanupEngines()

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
          const targetFrame =
            playheadPosition - activeClip.timeline_in + activeClip.source_in
          await newDemuxer.seekAndDisplay(targetFrame)
        }

        demuxerRef.current = newDemuxer
        setDemuxer(newDemuxer)

        // Initialize Audio Engine if we have a context
        if (audioCtx) {
          const newAudioEngine = new AudioEngine(audioCtx)
          const audioProvider = new MP4AudioProvider(activeAsset.file_path)
          await newAudioEngine.addTrack(activeAsset.id, audioProvider)

          if (cancelled) {
            newAudioEngine.dispose()
            return
          }

          // PRE-SEEK audio engine
          if (activeClip) {
            const targetFrame =
              playheadPosition - activeClip.timeline_in + activeClip.source_in
            newAudioEngine.seekByTime(
              targetFrame / (activeProject?.framerate || 30),
            )
          }

          audioEngineRef.current = newAudioEngine
          setAudioEngine(newAudioEngine)
        }
      } catch (error) {
        console.error('Failed to initialize preview engines:', error)
      } finally {
        if (!cancelled) {
          setIsInitializing(false)
        }
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
    audioCtx,
    activeProject?.framerate,
  ])

  // Real cleanup on unmount
  useEffect(() => {
    return () => {
      demuxerRef.current?.dispose()
      audioEngineRef.current?.dispose()
    }
  }, [])

  if (!activeProject) return null

  return (
    <div className="flex h-full flex-col bg-black/40 p-4">
      <div className="relative mx-auto flex aspect-video w-full max-w-[90%] flex-1 items-center justify-center overflow-hidden border border-white/5 bg-black text-white/20 shadow-2xl">
        {isInitializing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
              <span className="text-[10px] font-medium tracking-widest uppercase opacity-50">
                Initializing Engine...
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
