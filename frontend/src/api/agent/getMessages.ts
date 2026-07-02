import { commands } from '../bindings';
import type { Message } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const getMessages = (sessionId: string): Promise<Message[]> =>
  unwrap(commands.getMessages(sessionId));
