import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const renameAsset = async (
  assetId: string,
  newName: string,
): Promise<void> => {
  await unwrap(commands.renameAsset(assetId, newName));
};
