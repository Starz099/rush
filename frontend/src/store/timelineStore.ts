import { create } from 'zustand'
import { VideoDemuxer } from '../engine/Demuxer'

interface AppState {
  readyAssets: Record<string, any>
  isPlaying: boolean
  playhead_position: number
  framerate: number

  prepareAsset: (assetId: string, filePath: string) => Promise<void>
  togglePlayback: () => void
  setPlayhead: (frame: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  readyAssets: {},
  isPlaying: false,
  playhead_position: 0,
  framerate: 60,

  prepareAsset: async (assetId, filePath) => {
    console.log(`Demuxing ${assetId}...`)
    const demuxer = new VideoDemuxer(filePath)

    try {
      const metadata = await demuxer.initialize()
      set((state) => ({
        readyAssets: {
          ...state.readyAssets,
          [assetId]: metadata,
        },
      }))

      console.log(`Asset ${assetId} is fully demuxed and ready for WebCodecs!`)
    } catch (error) {
      console.error(`Failed to demux ${assetId}:`, error)
    }
  },

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlayhead: (frame) => set({ playhead_position: frame }),
}))
