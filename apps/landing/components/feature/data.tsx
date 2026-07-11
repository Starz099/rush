import {
  ColumnsIcon,
  CpuIcon,
  SlidersIcon,
  LightningIcon,
  KeyIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react';
import { FeatureItem } from './types';

export const FEATURES: FeatureItem[] = [
  {
    id: 1,
    tag: 'THE TIMELINE',
    title: 'Layer Videos, Audio & Effects',
    description:
      'Arrange your project with ease. Drag, slice, and layer multiple video tracks, audio clips, and overlays on a responsive, frame-accurate timeline.',
    side: 'left',
    icon: <ColumnsIcon size={18} className="text-primary" />,
  },
  {
    id: 2,
    tag: 'AI CO-EDITOR',
    title: 'Edit Video by Chatting',
    description:
      'Describe the changes you want in plain English. Tell the AI agent to "cut silent gaps," "trim the intro," or "speed ramp this part," and watch it execute the edits on the timeline.',
    side: 'right',
    icon: <CpuIcon size={18} className="text-primary" />,
  },
  {
    id: 3,
    tag: 'PREVIEW CANVAS',
    title: 'Smooth 60 FPS Playback',
    description:
      'See your adjustments, transitions, and edits immediately. The rendering engine lets you preview cuts and canvas transforms in real-time without sluggish timelines or lag.',
    side: 'left',
    icon: <SlidersIcon size={18} className="text-primary" />,
  },
  {
    id: 4,
    tag: 'PERFORMANCE',
    title: 'Lightweight Desktop App',
    description:
      'Say goodbye to bloated video software that crashes your computer. Rush is a native desktop application that consumes very little RAM, keeping your system fast.',
    side: 'right',
    icon: <LightningIcon size={18} className="text-primary" />,
  },
  {
    id: 5,
    tag: 'COST SAVINGS',
    title: 'Pay Only For What You Use',
    description:
      'Keep control of your budget. Instead of paying expensive monthly subscription fees, plug in your own OpenAI or Anthropic API keys and pay only pennies per hour of active editing.',
    side: 'left',
    icon: <KeyIcon size={18} className="text-primary" />,
  },
  {
    id: 6,
    tag: 'SMART SEARCH',
    title: 'Search Video in Plain English',
    description:
      'Quickly find the exact moment in hours of raw clips. Type descriptions like "smiling person" or "city drone shot," and let the local search bar highlight those frames instantly.',
    side: 'right',
    icon: <MagnifyingGlassIcon size={18} className="text-primary" />,
  },
];
