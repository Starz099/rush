import { commands } from '../bindings';
import type { Asset } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const registerAsset = (
  projectId: string,
  filePath: string,
  durationMs: number | null,
): Promise<Asset> =>
  unwrap(commands.registerAsset(projectId, filePath, durationMs as any));
