export interface FrameInfo {
  index: number;
  cts: number;
  duration: number;
  offset: number;
  size: number;
  isKeyframe: boolean;
}

export interface DemuxerMetadata {
  codec: string;
  width: number;
  height: number;
  durationSeconds: number;
  timescale: number;
  description?: ArrayBuffer;
}
