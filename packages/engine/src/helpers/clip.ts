export function getZIndex(clip: any): number {
  if (clip.effect_type === 'text') {
    return clip.effect_config?.z_index ?? 0;
  }
  return clip.transform?.z_index ?? 0;
}
