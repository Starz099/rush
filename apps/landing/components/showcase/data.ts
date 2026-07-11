import { ShowcaseStage } from './types';

export const STAGES: ShowcaseStage[] = [
  {
    id: 'import',
    stageNum: '01',
    tag: 'ASSET PIPELINE',
    title: 'Import Assets',
    subSteps: [
      {
        id: 'BROWSER_OPEN',
        duration: 2200,
        title: 'Choose Local Media',
        description:
          'Select your video footage or audio recordings from your local directories. Because Rush runs completely offline, your raw assets never upload to the cloud.',
        latency: '0ms',
        offload: 'OS NATIVE',
        model: 'Explorer Hook',
        taskToast: null,
      },
      {
        id: 'AUDIO_INDEX',
        duration: 2500,
        title: 'Whisper AI Audio Scan',
        description:
          'Rush transcribes the dialogue on your audio track instantly using Whisper AI on your device. This creates a searchable text index of everything said.',
        latency: '< 18ms',
        offload: '100% LOCAL',
        model: 'Whisper Base',
        taskToast: {
          type: 'Transcribing Speech',
          message: 'Running local Whisper audio indexing...',
          status: 'running',
        },
      },
      {
        id: 'VISUAL_INDEX',
        duration: 2500,
        title: 'Visual Storyboard Scan',
        description:
          'The media engine indexes your video frames. This scans the storyboard layout so you can easily query visual details using search prompts later.',
        latency: '< 8ms',
        offload: '100% GPU',
        model: 'CLIP ViT-B/32',
        taskToast: {
          type: 'Visual Indexing',
          message: 'Generating frame embeddings for raw footage...',
          status: 'running',
        },
      },
    ],
  },
  {
    id: 'prompt',
    stageNum: '02',
    tag: 'AI ASSISTANT',
    title: 'AI-Assisted Edits',
    subSteps: [
      {
        id: 'TYPE_PROMPT',
        duration: 3000,
        title: 'Submit Edit Instructions',
        description:
          'Ask the assistant to clean up your timeline by typing commands in plain English: "clean silent gaps and insert city skyline b-roll".',
        latency: '0ms',
        offload: 'USER INPUT',
        model: 'Agent Panel',
        taskToast: null,
        agentPrompt: 'clean silent gaps and insert city skyline b-roll',
      },
      {
        id: 'THINKING',
        duration: 1800,
        title: 'Assistant Planning',
        description:
          'The assistant details the edits: it finds quiet intervals on your audio timeline and searches your media folders for city skyline footage.',
        latency: '< 15ms',
        offload: '100% LOCAL',
        model: 'Llama 3 8B',
        taskToast: null,
        agentPrompt: 'clean silent gaps and insert city skyline b-roll',
        agentResponse:
          'Analyzing mic_audio.wav waveforms...\nScanning SQLite database for "skyline" visual vectors...',
      },
      {
        id: 'TIMELINE_EDIT',
        duration: 3000,
        title: 'Executing Timeline Cuts',
        description:
          'Watch the assistant slice out silence, shift the adjacent audio clips together, and insert the matching skyline B-roll segment automatically.',
        latency: '< 5ms',
        offload: '100% LOCAL',
        model: 'Rush Engine',
        taskToast: {
          type: 'Timeline Updates',
          message: 'Applying non-destructive cuts and tracks...',
          status: 'running',
        },
        agentPrompt: 'clean silent gaps and insert city skyline b-roll',
        agentResponse:
          '✓ Scanned waveforms. Deleted silent gap at 4.5s - 6.5s.\n✓ Queried vector db. Appended skyline_broll.mp4 (94% match) on Track V1.',
      },
      {
        id: 'TASK_COMPLETE',
        duration: 2000,
        title: 'Edits Finalized',
        description:
          'The timeline updates instantly with non-destructive trims, and the assistant provides a summary of the edits made.',
        latency: '< 1ms',
        offload: '100% LOCAL',
        model: 'Agent Panel',
        taskToast: {
          type: 'Timeline Updates',
          message: 'Timeline edits applied successfully.',
          status: 'completed',
        },
        agentPrompt: 'clean silent gaps and insert city skyline b-roll',
        agentResponse:
          '✓ Cuts applied. Gaps shifted.\n✓ skyline_broll.mp4 inserted on Track V1.',
      },
    ],
  },
  {
    id: 'adjust',
    stageNum: '03',
    tag: 'MANUAL EDITING',
    title: 'Manual Adjustments',
    subSteps: [
      {
        id: 'SELECT_CLIP',
        duration: 3500,
        title: 'Inspect Clip Parameters',
        description:
          'Click any segment on the non-linear timeline to check its details. The right properties panel instantly displays its position, scale, and volume values.',
        latency: '0ms',
        offload: 'USER FOCUS',
        model: 'Timeline Node',
        taskToast: null,
      },
      {
        id: 'PARAMETER_TWEAK',
        duration: 4000,
        title: 'Manual Layout Fine-Tuning',
        description:
          'Adjust positions, clip sizes, or angles manually. Because the preview engine is hardware-accelerated, the viewport updates in real-time with zero lag.',
        latency: '< 2ms',
        offload: '100% GPU',
        model: 'Rush Preview',
        taskToast: null,
      },
    ],
  },
  {
    id: 'export',
    stageNum: '04',
    tag: 'HARDWARE EXPORT',
    title: 'Export Video',
    subSteps: [
      {
        id: 'EXPORT_CLICK',
        duration: 1500,
        title: 'Prepare Output Settings',
        description:
          'Click Export to finalize your project. Set your target output format, frame rate, and export resolution properties.',
        latency: '0ms',
        offload: 'USER ACTION',
        model: 'Export Drawer',
        taskToast: null,
      },
      {
        id: 'WEBGPU_ENCODE',
        duration: 2500,
        title: 'Graphics Card Rendering',
        description:
          'Rush renders your timeline edits directly on your graphics card using WebGPU, encoding individual video frames at maximum speed.',
        latency: '< 4ms',
        offload: '100% GPU',
        model: 'WebGPU Pipeline',
        taskToast: null,
      },
      {
        id: 'FFMPEG_MUX',
        duration: 2000,
        title: 'Assembling Final Video File',
        description:
          'The final video frames and audio streams are compiled together into a lightweight MP4 container file, saved directly to your local drive.',
        latency: '< 10ms',
        offload: '100% LOCAL',
        model: 'FFmpeg WASM',
        taskToast: null,
      },
    ],
  },
];
