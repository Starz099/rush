import { commands, type Asset } from './bindings'
import { unwrap } from '@/helpers/specta'

export const assetApi = {
  register: (
    projectId: string,
    filePath: string,
    durationMs: number | null,
  ): Promise<Asset> =>
    unwrap(commands.registerAsset(projectId, filePath, durationMs as any)),

  getAll: (projectId: string): Promise<Asset[]> =>
    unwrap(commands.getAssets(projectId)),

  delete: async (assetId: string): Promise<void> => {
    await unwrap(commands.deleteAsset(assetId))
  },
  rename: async (assetId: string, newName: string): Promise<void> => {
    await unwrap(commands.renameAsset(assetId, newName))
  },
}
