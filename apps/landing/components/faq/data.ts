export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    id: 1,
    question: 'Is my video footage safe? Does it get uploaded to a server?',
    answer:
      'Yes, it is 100% safe. Rush is a local-first application. Video decoding, audio transcription, and frame search indexing run locally on your hardware. Your raw media assets never leave your machine.',
  },
  {
    id: 2,
    question: 'How do I pay for the AI agent? Is there a subscription?',
    answer:
      'Rush itself is free and open-source. To use the AI agent, you plug in your own API key from providers like OpenAI or Anthropic, or connect it to a free local model. You only pay the raw API cost of the prompts you submit (usually just a few cents per hour of active editing).',
  },
  {
    id: 3,
    question: 'What system specs are recommended to run Rush smoothly?',
    answer:
      'Rush runs on Windows, macOS, and Linux. For optimal performance (especially local transcription and visual search indexing), we recommend at least 16GB of system RAM and a dedicated GPU (Apple Silicon, NVIDIA, or AMD) to handle local AI processing.',
  },
  {
    id: 4,
    question: 'Can I use Rush completely offline?',
    answer:
      'Yes. General editing, timeline playback, local audio transcription, and visual search are 100% offline. The only feature requiring internet is the AI Agent panel, and only if you choose to connect it to cloud models like GPT-4 or Claude.',
  },
  {
    id: 5,
    question: 'How does semantic video search work without the cloud?',
    answer:
      'When you import a video, Rush uses a small local visual model to index keyframes, saving these search signatures into a secure local database. Searching for text compares your query against this local index in milliseconds.',
  },
];
