import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createAssetSlice, type AssetSlice } from './slices/assetSlice';
import { createClipSlice, type ClipSlice } from './slices/clipSlice';
import {
  createBackgroundSlice,
  type BackgroundSlice,
} from './slices/backgroundSlice';

type StoreState = ProjectSlice & AssetSlice & ClipSlice & BackgroundSlice;

export const useProjectStore = create<StoreState>((...a) => ({
  ...createProjectSlice(...a),
  ...createAssetSlice(...a),
  ...createClipSlice(...a),
  ...createBackgroundSlice(...a),
}));
