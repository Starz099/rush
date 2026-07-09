import type { ResolutionValue, FPSValue } from '@/types/project';

export const RESOLUTIONS: {
  label: string;
  value: ResolutionValue;
  width: number;
  height: number;
}[] = [
  { label: '1080p (16:9)', value: '1080p', width: 1920, height: 1080 },
  { label: '4K UHD (16:9)', value: '4k', width: 3840, height: 2160 },
  {
    label: 'Vertical / Shorts (9:16)',
    value: 'vertical',
    width: 1080,
    height: 1920,
  },
];

export const FPS_OPTIONS: { label: string; value: FPSValue }[] = [
  { label: '15 FPS', value: '15' },
  { label: '30 FPS', value: '30' },
  { label: '60 FPS', value: '60' },
];

export const DEFAULT_PROJECT_CONFIG = {
  RESOLUTION: '1080p' as ResolutionValue,
  FPS: '60' as FPSValue,
} as const;
