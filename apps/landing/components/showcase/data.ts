import { ShowcaseStep } from './types';

export const STEPS: ShowcaseStep[] = [
  {
    id: 'silence',
    stepNum: '01',
    tag: 'AI ASSISTANT',
    title: 'Edit Video by Chatting',
    description:
      'A chat panel docked next to your timeline. Type commands like "remove silences" or "trim the intro hook," and the agent makes frame-accurate edits for you automatically.',
    latency: '< 18ms',
    offload: '100% LOCAL',
    model: 'Whisper Base',
    projectName: 'interview_cleanup.rsh',
    dimensions: '1920x1080',
    framerate: 24,
    taskToast: {
      type: 'Transcribing Speech',
      message: 'Running local Whisper audio indexing...',
      progress: 100,
      status: 'completed',
    },
    agentPrompt: 'clean silent gaps from audio track',
    agentResponse:
      '✓ Scanned mic_audio.wav. Found silence at 4.5s - 6.5s. Split track, deleted segment, and shifted track V1/A1 left.',
  },
  {
    id: 'embeddings',
    stepNum: '02',
    tag: 'SMART SEARCH',
    title: 'Search Video in Plain English',
    description:
      'Quickly find the exact moment in hours of footage. Search your media bin for visual concepts like "drone shot of coffee" or "laughing face," and see matching clips highlighted instantly.',
    latency: '< 8ms',
    offload: '100% GPU',
    model: 'CLIP ViT-B/32',
    projectName: 'cinematic_broll.rsh',
    dimensions: '3840x2160',
    framerate: 30,
    taskToast: {
      type: 'Visual Indexing',
      message: 'Generating frame embeddings for vlog_footage...',
      progress: 92,
      status: 'running',
    },
    agentPrompt: 'find cinematic city skyline b-roll and insert it',
    agentResponse:
      '✓ Queried local vector database. Found "skyline_broll.mp4" (94% match). Appended 5-second clip to Track V1.',
  },
  {
    id: 'transform',
    stepNum: '03',
    tag: 'PREVENT CRASHES',
    title: 'Smooth, Lightweight Timeline',
    description:
      'A fast, keyboard-first timeline built for speed. Move clips, preview adjustments, and adjust scale or crop handles manually with zero latency and low memory usage.',
    latency: '< 2ms',
    offload: '100% LOCAL',
    model: 'Rush Engine',
    projectName: 'timeline_transforms.rsh',
    dimensions: '1920x1080',
    framerate: 24,
    taskToast: {
      type: 'Model Weights',
      message: 'Timeline assets checking completed.',
      progress: 100,
      status: 'completed',
    },
    agentPrompt: 'scale active video clip to 140%',
    agentResponse:
      '✓ Calculated transform matrix. Scaled selected segment to 1.40x. Rendered canvas viewport.',
  },
];
