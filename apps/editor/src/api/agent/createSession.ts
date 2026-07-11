import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';
import type { Session } from '../bindings';

export const createSession = (projectId: string): Promise<Session> =>
  unwrap(commands.createSession(projectId));
