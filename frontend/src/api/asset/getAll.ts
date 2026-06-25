import { commands } from '../bindings';
import type { Asset } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const getAssets = (projectId: string): Promise<Asset[]> =>
  unwrap(commands.getAssets(projectId));
