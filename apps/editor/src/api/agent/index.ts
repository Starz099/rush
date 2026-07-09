import { getMessages } from './getMessages';
import { getSessions } from './getSessions';
import { runAgent } from './runAgent';
import { deleteSession } from './deleteSession';

export const agentApi = {
  getSessions,
  getMessages,
  runAgent,
  deleteSession,
};
