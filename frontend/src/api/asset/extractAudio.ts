import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const extractAudio = (filePath: string): Promise<string> =>
  unwrap(commands.extractAudio(filePath));
