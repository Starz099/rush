import { create } from 'zustand'
import type { Asset } from '@/api/bindings'

interface WorkspaceState {
  selectedAsset: Asset | null
  selectedClipId: string | null
  selectedTrackId: string | null
  isPlaying: boolean
  allowOverlap: boolean

  setSelectedAsset: (asset: Asset | null) => void
  setClipSelection: (trackId: string | null, clipId: string | null) => void
  clearSelection: () => void

  setIsPlaying: (playing: boolean) => void
  togglePlaying: () => void
  setAllowOverlap: (allow: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedAsset: null,
  selectedClipId: null,
  selectedTrackId: null,
  isPlaying: false,
  allowOverlap: false,

  setSelectedAsset: (asset: Asset | null) =>
    set({
      selectedAsset: asset,
      selectedClipId: null,
      selectedTrackId: null,
    }),

  setClipSelection: (trackId: string | null, clipId: string | null) =>
    set({
      selectedClipId: clipId,
      selectedTrackId: trackId,
      selectedAsset: null,
    }),

  clearSelection: () =>
    set({
      selectedAsset: null,
      selectedClipId: null,
      selectedTrackId: null,
    }),
  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setAllowOverlap: (allow) => set({ allowOverlap: allow }),
}))
