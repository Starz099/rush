import { ShowcaseStep } from './types';

export const STEPS: ShowcaseStep[] = [
  {
    id: 'silence',
    stepNum: '01',
    tag: 'SPEECH EDITS',
    title: 'Automated Audio Cleanup',
    description:
      'Remove silent segments from waveforms automatically. Rush runs local audio transcription and slices the timeline, collapsing gaps without losing sync.',
    latency: '< 18ms',
    offload: '100% LOCAL',
    model: 'Whisper Base',
    projectName: 'interview_cleanup_v1.rsh',
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
    tag: 'SEMANTIC INDEXING',
    title: 'Semantic Storyboard Search',
    description:
      'Query visual concepts across video footage in natural language. The Rust preprocessor indexes storyboard tiles with local CLIP embeddings for instant search.',
    latency: '< 8ms',
    offload: '100% GPU',
    model: 'CLIP ViT-B/32',
    projectName: 'cinematic_broll_v2.rsh',
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
    tag: 'WEBGPU RENDERING',
    title: 'WebGPU Spatial Transforms',
    description:
      'Scale, rotate, and reposition clips by describing your vision. Commands compile to transform matrices rendered in real-time via WebGPU pipelines.',
    latency: '< 2ms',
    offload: '100% LOCAL',
    model: 'Rush Engine',
    projectName: 'transform_grades.rsh',
    dimensions: '1920x1080',
    framerate: 24,
    taskToast: {
      type: 'Model Weights',
      message: 'Tauri assets checking completed.',
      progress: 100,
      status: 'completed',
    },
    agentPrompt: 'scale active video clip to 140%',
    agentResponse:
      '✓ Calculated transform matrix. Scaled selected segment to 1.40x. Rendered WebGPU viewport.',
  },
];
