import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const deleteAsset = async (assetId: string): Promise<void> => {
  await unwrap(commands.deleteAsset(assetId));
};
