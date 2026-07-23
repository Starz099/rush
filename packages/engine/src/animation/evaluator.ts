import { applyEasing, type EaseCurveType } from './easing';

export interface Keyframe<T> {
  frame: number;
  value: T;
  ease_curve: EaseCurveType;
}

export interface Animatable<T> {
  has_keyframes: boolean;
  value: T;
  keyframes: Keyframe<T>[];
}

/**
 * Interpolates between two numbers
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Evaluates an animatable numeric property at a given frame.
 */
export function evaluateAnimatable(
  prop: Animatable<number> | undefined | null,
  frame: number,
  defaultValue: number,
): number {
  if (!prop) return defaultValue;
  if (!prop.has_keyframes || !prop.keyframes || prop.keyframes.length === 0) {
    return prop.value !== undefined ? prop.value : defaultValue;
  }

  // Ensure keyframes are sorted by frame index
  const sorted = [...prop.keyframes].sort((a, b) => a.frame - b.frame);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (frame <= first.frame) {
    return first.value;
  }
  if (frame >= last.frame) {
    return last.value;
  }

  // Find the bounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i];
    const next = sorted[i + 1];

    if (frame >= prev.frame && frame <= next.frame) {
      const range = next.frame - prev.frame;
      if (range === 0) return prev.value;

      const t = (frame - prev.frame) / range;
      const easedT = applyEasing(prev.ease_curve, t);
      return lerp(prev.value, next.value, easedT);
    }
  }

  return prop.value !== undefined ? prop.value : defaultValue;
}
