import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const deleteSession = (sessionId: string): Promise<void> =>
  unwrap(commands.deleteSession(sessionId)).then(() => {});
