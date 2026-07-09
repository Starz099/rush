import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const readAssetBytes = (filePath: string): Promise<number[]> =>
  unwrap(commands.readAssetBytes(filePath));
