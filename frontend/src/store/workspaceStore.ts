import { create } from 'zustand'
import type { Asset } from '@/api/bindings'

interface WorkspaceState {
  selectedAsset: Asset | null
  isPlaying: boolean
  setSelectedAsset: (asset: Asset | null) => void
  setIsPlaying: (playing: boolean) => void
  togglePlaying: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedAsset: null,
  isPlaying: false,
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
}))
