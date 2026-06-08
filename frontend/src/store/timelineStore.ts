import { create } from 'zustand'
import { VideoDemuxer } from '../engine/Demuxer'

interface AppState {
  // Stores metadata about ready assets (codec, etc)
  readyAssets: Record<string, any>

  // The action to trigger the demuxer
  prepareAsset: (assetId: string, filePath: string) => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  readyAssets: {},

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
}))
