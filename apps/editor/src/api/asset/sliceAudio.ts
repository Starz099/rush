import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const sliceAudioAsset = (
  filePath: string,
  startSec: number,
  durationSec: number,
): Promise<string> =>
  unwrap(commands.sliceAudioAsset(filePath, startSec, durationSec));
