export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    id: 1,
    question: 'Is my video data sent to any cloud server?',
    answer:
      'No. Rush is a local-first application. Video decoding, transcription, semantic analysis, and canvas rendering are executed 100% on-device. No media files or metadata are ever transmitted over the network.',
  },
  {
    id: 2,
    question: 'Why use Tauri instead of Electron?',
    answer:
      'Tauri replaces Electron’s bloated Chromium engine with the OS’s native webview and runs a lightweight Rust backend. This results in RAM savings of up to 90%, and keeps the application footprint under 15MB.',
  },
  {
    id: 3,
    question: 'How does local semantic video search work?',
    answer:
      'Upon importing video assets, the Rust backend extracts keyframes and generates vector embeddings using a local CLIP model. These embeddings are stored in a local SQLite database. When you search, the query is vectorized and compared against the index in real-time.',
  },
  {
    id: 4,
    question: 'Why WebGPU for the preview renderer?',
    answer:
      'WebGPU provides modern, low-level GPU access in the browser webview. This allows Rush to compile custom shader passes for instant LUT color grading, pixel transformations, and frame-accurate canvas drawing at 60 FPS.',
  },
  {
    id: 5,
    question: 'How are editing commands executed?',
    answer:
      'Rush uses a local agent loop. When you input an editing task in plain text, the LLM planner parses the prompt and issues native Tauri commands to Rust. The Rust engine updates the database and triggers timeline updates in the UI.',
  },
];
