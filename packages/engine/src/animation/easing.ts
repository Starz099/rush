export type EaseCurveType =
  'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'spring' | 'bounce';

export function easeLinear(t: number): number {
  return t;
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Damped spring simulation (elastic ease out)
 */
export function easeSpring(t: number): number {
  if (t === 0 || t === 1) return t;
  const p = 0.3; // period
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
}

/**
 * Bounce ease out simulation (gravity bounce)
 */
export function easeBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  let tempT = t;
  if (tempT < 1 / d1) {
    return n1 * tempT * tempT;
  } else if (tempT < 2 / d1) {
    tempT -= 1.5 / d1;
    return n1 * tempT * tempT + 0.75;
  } else if (tempT < 2.5 / d1) {
    tempT -= 2.25 / d1;
    return n1 * tempT * tempT + 0.9375;
  } else {
    tempT -= 2.625 / d1;
    return n1 * tempT * tempT + 0.984375;
  }
}

export function applyEasing(curve: EaseCurveType, t: number): number {
  const normalizedCurve = ((curve as string) || '').toLowerCase();
  switch (normalizedCurve) {
    case 'linear':
      return easeLinear(t);
    case 'ease_in':
    case 'easein':
      return easeInQuad(t);
    case 'ease_out':
    case 'easeout':
      return easeOutQuad(t);
    case 'ease_in_out':
    case 'easeinout':
      return easeInOutQuad(t);
    case 'spring':
      return easeSpring(t);
    case 'bounce':
      return easeBounce(t);
    default:
      return t;
  }
}
