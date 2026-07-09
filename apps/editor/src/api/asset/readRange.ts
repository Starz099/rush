import { commands, type RangeResult } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const readAssetRange = (
  filePath: string,
  offset: number,
  length: number,
): Promise<RangeResult> =>
  unwrap(commands.readAssetRange(filePath, offset, length));
