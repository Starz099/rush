export const RESOLUTIONS = [
  { label: '1080p (16:9)', value: '1080p', width: 1920, height: 1080 },
  { label: '4K UHD (16:9)', value: '4k', width: 3840, height: 2160 },
  {
    label: 'Vertical / Shorts (9:16)',
    value: 'vertical',
    width: 1080,
    height: 1920,
  },
] as const

export const FPS_OPTIONS = [24, 30, 60] as const

export const DEFAULT_PROJECT_CONFIG = {
  RESOLUTION: '1080p',
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: '30',
} as const
