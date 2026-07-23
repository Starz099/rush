import { create } from 'zustand';
import type { Asset } from '@/api/bindings';
import type { EditingTool } from '@/types/editor';

interface WorkspaceState {
  selectedAsset: Asset | null;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedTransitionId: string | null;
  isPlaying: boolean;
  activeTool: EditingTool;

  setSelectedAsset: (asset: Asset | null) => void;
  setClipSelection: (trackId: string | null, clipId: string | null) => void;
  setTransitionSelection: (
    trackId: string | null,
    transitionId: string | null,
  ) => void;
  clearSelection: () => void;

  setIsPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setActiveTool: (tool: EditingTool) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedAsset: null,
  selectedClipId: null,
  selectedTrackId: null,
  selectedTransitionId: null,
  isPlaying: false,
  activeTool: 'select',

  setSelectedAsset: (asset: Asset | null) =>
    set({
      selectedAsset: asset,
      selectedClipId: null,
      selectedTrackId: null,
      selectedTransitionId: null,
    }),

  setClipSelection: (trackId: string | null, clipId: string | null) =>
    set({
      selectedClipId: clipId,
      selectedTrackId: trackId,
      selectedAsset: null,
      selectedTransitionId: null,
    }),

  setTransitionSelection: (
    trackId: string | null,
    transitionId: string | null,
  ) =>
    set({
      selectedTransitionId: transitionId,
      selectedTrackId: trackId,
      selectedClipId: null,
      selectedAsset: null,
    }),

  clearSelection: () =>
    set({
      selectedAsset: null,
      selectedClipId: null,
      selectedTrackId: null,
      selectedTransitionId: null,
    }),
  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setActiveTool: (tool: EditingTool) => set({ activeTool: tool }),
}));
