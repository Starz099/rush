export type PhaseId = 'silence' | 'embeddings' | 'transform';

export interface ShowcaseStep {
  id: PhaseId;
  stepNum: string;
  tag: string;
  title: string;
  description: string;

  // Dashboard Telemetry
  latency: string;
  offload: string;
  model: string;

  // Workspace properties
  projectName: string;
  dimensions: string;
  framerate: number;
  taskToast: {
    type: string;
    message: string;
    progress: number;
    status: string;
  } | null;
  agentPrompt: string;
  agentResponse: string;
}
