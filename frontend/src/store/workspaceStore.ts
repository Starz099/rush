import { create } from 'zustand'
import type { Asset } from '@/api/bindings'

interface WorkspaceState {
  selectedAsset: Asset | null
  setSelectedAsset: (asset: Asset | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedAsset: null,
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),
}))
