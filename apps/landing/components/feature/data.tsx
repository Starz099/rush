import {
  ColumnsIcon,
  CpuIcon,
  SlidersIcon,
  StackIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { FeatureItem } from './types';

export const FEATURES: FeatureItem[] = [
  {
    id: 1,
    tag: 'TIMELINE',
    title: 'Multi-Track NLE Engine',
    description:
      'Arrange your project with frame-accurate precision. Drag, slice, trim, and overlay unlimited video and audio channels on a low-latency timeline.',
    side: 'left',
    icon: <ColumnsIcon size={18} className="text-primary" />,
  },
  {
    id: 2,
    tag: 'AI AGENT',
    title: 'Local Co-Editor Assistant',
    description:
      'An intelligent desktop agent connected directly to the timeline. Describe edits in plain English—like cutting dead air—and let the agent call local Rust tools.',
    side: 'right',
    icon: <CpuIcon size={18} className="text-primary" />,
  },
  {
    id: 3,
    tag: 'SPATIAL EFFECTS',
    title: 'GPU-Accelerated Shaders',
    description:
      'Translate adjustment commands into GPU shaders instantly. Scale, rotate, crop, or apply filter grades in real-time, rendered directly in the browser window at 60 FPS.',
    side: 'left',
    icon: <SlidersIcon size={18} className="text-primary" />,
  },
  {
    id: 4,
    tag: 'COMPOSITING',
    title: 'Overlapping Track Mixes',
    description:
      'Layer clips across multiple video tracks to compose complex overlays, picture-in-picture, and track transits. The rendering pipeline blends overlapping transparency.',
    side: 'right',
    icon: <StackIcon size={18} className="text-primary" />,
  },
  {
    id: 5,
    tag: 'EXPORT',
    title: 'Hardware MP4 Encoding',
    description:
      'Compile your final project directly into MP4 container streams using local hardware acceleration. Configure resolution profiles, framerates, and bitrates with a single click.',
    side: 'left',
    icon: <DownloadSimpleIcon size={18} className="text-primary" />,
  },
];
