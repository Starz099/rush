import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const runAgent = (
  projectId: string,
  sessionId: string,
  prompt: string,
): Promise<string> => unwrap(commands.runAgent(projectId, sessionId, prompt));
