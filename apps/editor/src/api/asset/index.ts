import { registerAsset } from './register';
import { getAssets } from './getAll';
import { deleteAsset } from './delete';
import { renameAsset } from './rename';
import { readAssetBytes } from './readBytes';
import { extractAudio } from './extractAudio';
import { readAssetRange } from './readRange';
import { readMoovBox } from './readMoovBox';
import { sliceAudioAsset } from './sliceAudio';

export const assetApi = {
  register: registerAsset,
  getAll: getAssets,
  delete: deleteAsset,
  rename: renameAsset,
  readBytes: readAssetBytes,
  extractAudio,
  readRange: readAssetRange,
  readMoovBox,
  sliceAudio: sliceAudioAsset,
};
