/**
 * Calculates the Mean Absolute Difference (MAD) between two luma grids.
 */
export function calculateMAD(gridA: Float32Array, gridB: Float32Array): number {
  let diff = 0;
  for (let i = 0; i < 64; i++) {
    diff += Math.abs(gridA[i] - gridB[i]);
  }
  return diff / 64.0;
}
