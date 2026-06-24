import { commands, type RangeResult } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const readMoovBox = (filePath: string): Promise<RangeResult> =>
  unwrap(commands.readMoovBox(filePath));
