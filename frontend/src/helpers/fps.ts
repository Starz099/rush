import type { FPSValue } from '@/types/project'

export function fpsToNumeric(fps: FPSValue | number | undefined): number {
  if (typeof fps === 'number') return fps
  if (!fps) return 30

  const numeric = parseInt(fps as string, 10)
  return isNaN(numeric) ? 30 : numeric
}
