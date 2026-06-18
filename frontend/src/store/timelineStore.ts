import { create } from 'zustand'
import { RangeDemuxer } from '../engine/demuxers/RangeDemuxer'
import { invoke } from '@tauri-apps/api/core'

interface AppState {
  readyAssets: Record<string, any>
  extractedAudios: Record<string, string> // Map assetId -> extracted MP3 path
  demuxingAssets: Record<string, boolean> // Map assetId -> loading state
  isPlaying: boolean
  playhead_position: number
  framerate: number

  prepareAsset: (assetId: string, filePath: string) => Promise<void>
  togglePlayback: () => void
  setPlayhead: (frame: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  readyAssets: {},
  extractedAudios: {},
  demuxingAssets: {},
  isPlaying: false,
  playhead_position: 0,
  framerate: 60,

  prepareAsset: async (assetId, filePath) => {
    console.log(
      `[Store] Starting preparation for asset ${assetId}: ${filePath}`,
    )
    set((state) => ({
      demuxingAssets: {
        ...state.demuxingAssets,
        [assetId]: true,
      },
    }))

    const isAudio =
      filePath.toLowerCase().endsWith('.mp3') ||
      filePath.toLowerCase().endsWith('.wav') ||
      filePath.toLowerCase().endsWith('.aac') ||
      filePath.toLowerCase().endsWith('.m4a') ||
      filePath.toLowerCase().endsWith('.ogg') ||
      filePath.toLowerCase().endsWith('.flac')

    if (isAudio) {
      set((state) => ({
        readyAssets: {
          ...state.readyAssets,
          [assetId]: { durationSeconds: 0 }, // Standalone audio assets are ready immediately
        },
        extractedAudios: {
          ...state.extractedAudios,
          [assetId]: filePath, // No extraction needed, use file directly
        },
        demuxingAssets: {
          ...state.demuxingAssets,
          [assetId]: false,
        },
      }))
      console.log(`[Store] Standalone audio asset ${assetId} is ready!`)
      return
    }

    const demuxer = new RangeDemuxer(filePath)

    try {
      // 1. Demux metadata using RangeDemuxer (fast range request headers)
      console.log(`[Store] Initializing demuxer for ${assetId}...`)
      const metadata = await demuxer.initialize()
      console.log(
        `[Store] Demuxer initialized for ${assetId}. Metadata:`,
        metadata,
      )

      // 2. Extract audio track using FFmpeg in backend
      let extractedAudioPath = ''
      try {
        console.log(`[Store] Requesting audio extraction for ${assetId}...`)
        extractedAudioPath = await invoke<string>('extract_audio', { filePath })
        console.log(
          `[Store] Audio extraction succeeded for ${assetId}: ${extractedAudioPath}`,
        )
      } catch (audioErr) {
        console.warn(
          `[Store] Audio extraction skipped or failed for ${assetId}:`,
          audioErr,
        )
      }

      set((state) => ({
        readyAssets: {
          ...state.readyAssets,
          [assetId]: metadata,
        },
        extractedAudios: {
          ...state.extractedAudios,
          [assetId]: extractedAudioPath,
        },
        demuxingAssets: {
          ...state.demuxingAssets,
          [assetId]: false,
        },
      }))

      console.log(
        `[Store] Asset ${assetId} is fully prepared and ready for playback!`,
      )
    } catch (error) {
      console.error(`[Store] Failed to prepare asset ${assetId}:`, error)
      set((state) => ({
        demuxingAssets: {
          ...state.demuxingAssets,
          [assetId]: false,
        },
      }))
    }
  },

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlayhead: (frame) => set({ playhead_position: frame }),
}))
