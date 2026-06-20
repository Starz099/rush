/**
 * Metadata required to configure the WebCodecs AudioDecoder
 */
export interface AudioMetadata {
  codec: string;
  sampleRate: number;
  channels: number;
  timescale: number;
  duration?: number;
  description?: ArrayBuffer; // For AAC and other codecs requiring extradata
  isEncoded: boolean;
}

/**
 * A single compressed audio sample (packet)
 */
export interface AudioSample {
  data: ArrayBuffer;
  cts: number;
  duration: number;
  is_sync: boolean;
}

/**
 * Interface for any audio source (MP4 video track, MP3, etc.)
 * that provides raw encoded samples to the AudioPipeline.
 */
export interface IAudioProvider {
  /**
   * Performs initial demuxing and fetches metadata
   */
  initialize(): Promise<AudioMetadata>;

  /**
   * Returns the configuration metadata
   */
  getMetadata(): AudioMetadata;

  /**
   * Returns a sample at a specific index
   */
  getSample(index: number): AudioSample | null;

  /**
   * Total number of samples available
   */
  getSampleCount(): number;

  /**
   * Finds the sample index for a given timestamp in seconds
   */
  findSampleIndex(timeInSeconds: number): number;

  /**
   * Clean up resources (close file handles, etc.)
   */
  dispose(): void;
}
