import { commands } from '../bindings';
import type { Session } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const getSessions = (projectId: string): Promise<Session[]> =>
  unwrap(commands.getSessions(projectId));
