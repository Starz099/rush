import { type Clip } from '@/api/bindings'

/**
 * Calculates which source frame should be displayed for a given playhead position on the timeline.
 *
 * @param playhead The current position of the playhead in the global timeline (in frames).
 * @param clip The clip being evaluated.
 * @returns The frame index within the source asset, or null if the playhead is outside the clip's range.
 */
export function getSourceFrameForPlayhead(
  playhead: number,
  clip: Clip,
): number | null {
  if (playhead < clip.timeline_in || playhead >= clip.timeline_out) {
    return null
  }

  const offsetFromStart = playhead - clip.timeline_in
  const targetSourceFrame = clip.source_in + offsetFromStart

  return targetSourceFrame
}
