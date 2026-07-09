export const AGENT_STATUS = {
  Thinking: 'thinking',
  Executing: 'executing',
  Idle: 'idle',
  Error: 'error',
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];
