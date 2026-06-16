import { useProjectStore } from '@/store/projectStore'
import { useAppStore } from '@/store/timelineStore'
import { usePlaybackLoop } from '@/hooks/usePlaybackLoop'
import { convertFileSrc } from '@tauri-apps/api/core'
import { FileIcon, FilmStripIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { WebGPURenderer } from '../engine/Renderer'
import { VideoEngine } from '../engine/VideoEngine'
import { AudioEngine } from '../engine/AudioEngine'
import { useAudioOrchestrator } from '@/hooks/useAudioOrchestrator'
import { useVideoOrchestrator } from '@/hooks/useVideoOrchestrator'
import { fpsToNumeric } from '@/helpers/fps'

export const PreviewPanel = () => {
  const activeProject = useProjectStore((state) => state.activeProject)
  const assets = useProjectStore((state) => state.assets)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Engine Refs
  const videoEngineRef = useRef<VideoEngine | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)

  const [videoEngine, setVideoEngine] = useState<VideoEngine | null>(null)
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null)
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  const isPlaying = useAppStore((state) => state.isPlaying)
  const playheadPosition = useAppStore((state) => state.playhead_position)

  const timeline = activeProject?.timeline_state
  const videoTracks =
    timeline?.tracks.filter((t: any) => t.track_type === 'video') || []

  // Active clips for scrubbing and UI hints
  const activeClips = videoTracks.flatMap((track: any) =>
    track.clips.filter(
      (clip: any) =>
        playheadPosition >= clip.timeline_in &&
        playheadPosition < clip.timeline_out,
    ),
  )

  const activeAsset =
    activeClips.length > 0
      ? assets.find((a) => a.id === activeClips[0].asset_id)
      : null

  const previewWidth = activeProject?.viewport_width ?? 1920
  const previewHeight = activeProject?.viewport_height ?? 1080
  const projectFps = fpsToNumeric(activeProject?.framerate)

  // Initialize Engines once on mount
  useEffect(() => {
    let cancelled = false

    const initEngines = async () => {
      // Wait for canvas to be available in the DOM
      if (!canvasRef.current) {
        // Retry in next tick if not ready
        setTimeout(initEngines, 50)
        return
      }

      try {
        setIsInitializing(true)

        // 1. Audio Engine
        if (!audioEngineRef.current) {
          const ctx = new AudioContext({ sampleRate: 48000 })
          setAudioCtx(ctx)
          const aEngine = new AudioEngine(ctx)
          audioEngineRef.current = aEngine
          setAudioEngine(aEngine)
        }

        // 2. Video Engine (with shared Renderer)
        if (canvasRef.current && !videoEngineRef.current) {
          canvasRef.current.width = previewWidth
          canvasRef.current.height = previewHeight

          const renderer = new WebGPURenderer(canvasRef.current)
          await renderer.initialize()

          if (cancelled) {
            renderer.dispose()
            return
          }

          const vEngine = new VideoEngine(renderer)
          videoEngineRef.current = vEngine
          setVideoEngine(vEngine)
        }
      } catch (error) {
        console.error('Failed to initialize engines:', error)
      } finally {
        if (!cancelled) {
          setIsInitializing(false)
        }
      }
    }

    initEngines()

    return () => {
      cancelled = true
      audioEngineRef.current?.dispose()
      videoEngineRef.current?.dispose()
      audioEngineRef.current = null
      videoEngineRef.current = null
    }
  }, []) // Mount-only

  // Attach the engine to the playback loop
  usePlaybackLoop(videoEngine, audioEngine, audioCtx)

  // Attach Orchestrators to manage tracks/clips
  useAudioOrchestrator(audioEngine, audioCtx)
  useVideoOrchestrator(videoEngine)

  // Resume AudioContext on user interaction (Play)
  useEffect(() => {
    if (isPlaying && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  }, [isPlaying, audioCtx])

  // Scrubbing logic (Sync when NOT playing)
  useEffect(() => {
    if (!isPlaying && videoEngine) {
      activeClips.forEach((clip: any) => {
        const sourceTime =
          (playheadPosition - clip.timeline_in + clip.source_in) / projectFps
        videoEngine.displayAtTime(clip.id, sourceTime)
      })

      // Trigger a synchronized render for the current scrubbed position
      videoEngine.renderFrame(activeClips)

      if (audioEngine) {
        // Audio engine still handles global sync for now
        const firstClip = activeClips[0]
        if (firstClip) {
          const sourceTime =
            (playheadPosition - firstClip.timeline_in + firstClip.source_in) /
            projectFps
          audioEngine.seekByTime(sourceTime)
        }
      }
    }
  }, [
    playheadPosition,
    isPlaying,
    videoEngine,
    audioEngine,
    activeClips.length,
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

        {/* VIDEO LAYER - Always mounted to keep WebGPU context alive */}
        <canvas
          ref={canvasRef}
          style={{
            display: activeAsset?.media_type === 'video' ? 'block' : 'none',
          }}
          className="h-full w-full bg-white/5 object-contain"
          width={previewWidth}
          height={previewHeight}
        />

        {/* IMAGE LAYER */}
        {activeAsset?.media_type === 'image' && (
          <img
            src={convertFileSrc(activeAsset.file_path)}
            alt={activeAsset.name}
            className="h-full w-full bg-white/5 object-contain"
          />
        )}

        {/* FALLBACKS */}
        {!activeAsset && !isInitializing && (
          <div className="flex flex-col items-center gap-2">
            <FilmStripIcon className="size-12 opacity-10" />
            <span className="text-[10px] font-medium tracking-widest uppercase opacity-20">
              No Clip at Playhead
            </span>
          </div>
        )}

        {activeAsset &&
          activeAsset.media_type !== 'video' &&
          activeAsset.media_type !== 'image' && (
            <div className="text-center">
              <FileIcon className="mx-auto mb-2 size-12 opacity-20" />
              <p className="text-xs">Preview not available</p>
            </div>
          )}
      </div>
    </div>
  )
}
