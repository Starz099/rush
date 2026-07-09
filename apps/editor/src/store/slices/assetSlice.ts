import type { StateCreator } from 'zustand';
import { assetApi } from '@/api/asset';
import type { Asset } from '@/api/bindings';

export interface AssetSlice {
  assets: Asset[];
  fetchAssets: (projectId: string) => Promise<void>;
  addAsset: (asset: Asset) => void;
  removeAsset: (assetId: string) => void;
  renameAsset: (assetId: string, newName: string) => Promise<void>;
}

export const createAssetSlice: StateCreator<AssetSlice, [], [], AssetSlice> = (
  set,
) => ({
  assets: [],

  fetchAssets: async (projectId) => {
    try {
      const assets = await assetApi.getAll(projectId);
      set({ assets });
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    }
  },

  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),

  removeAsset: (assetId) =>
    set((state) => ({ assets: state.assets.filter((a) => a.id !== assetId) })),

  renameAsset: async (assetId, newName) => {
    await assetApi.rename(assetId, newName);
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId ? { ...a, name: newName } : a,
      ),
    }));
  },
});
