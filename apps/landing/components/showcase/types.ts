export type StageId = 'import' | 'prompt' | 'adjust' | 'export';

export interface SubStep {
  id: string; // e.g. 'BROWSER_OPEN', 'AUDIO_INDEX', etc.
  duration: number; // in ms
  title: string;
  description: string;

  // Dashboard Telemetry
  latency: string;
  offload: string;
  model: string;

  // Custom states
  taskToast: {
    type: string;
    message: string;
    status: 'running' | 'completed';
  } | null;

  agentPrompt?: string;
  agentResponse?: string;
}

export interface ShowcaseStage {
  id: StageId;
  stageNum: string;
  tag: string;
  title: string;
  subSteps: SubStep[];
}
