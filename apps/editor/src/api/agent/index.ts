import { createSession } from './createSession';
import { getMessages } from './getMessages';
import { getSessions } from './getSessions';
import { runAgent } from './runAgent';
import { deleteSession } from './deleteSession';

export const agentApi = {
  createSession,
  getSessions,
  getMessages,
  runAgent,
  deleteSession,
};
