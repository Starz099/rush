import { commands } from '../bindings';
import { unwrap } from '@/helpers/specta';

export const runAgent = (
  projectId: string,
  sessionId: string,
  prompt: string,
  apiUrl?: string | null,
  apiKey?: string | null,
  model?: string | null,
): Promise<string> =>
  unwrap(
    commands.runAgent(
      projectId,
      sessionId,
      prompt,
      apiUrl ?? null,
      apiKey ?? null,
      model ?? null,
    ),
  );
