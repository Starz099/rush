import { exportApi } from '@/api/export';
import { avcToAnnexB } from './avcToAnnexB';
import { EXPORT_VIDEO_BITRATE } from '../constants/export';

/**
 * Manages the WebCodecs VideoEncoder life-cycle, hardware configuration,
 * H.264 Annex B stream conversions, and push requests to the backend.
 */
export class VideoEncoderSession {
  private encoder!: VideoEncoder;
  private pendingChunks: Promise<any>[] = [];
  private width: number;
  private height: number;
  private framerate: number;

  constructor(width: number, height: number, framerate: number) {
    this.width = width;
    this.height = height;
    this.framerate = framerate;
  }

  /**
   * Identifies supported H.264 profiles and configures the hardware/software VideoEncoder.
   */
  public async initialize(): Promise<void> {
    this.pendingChunks = [];

    // H.264 Level 4.2/4.0 profiles are required for 1080p 60fps limits.
    const codecs = ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42001e'];
    let selectedCodec = 'avc1.42001e';

    for (const codec of codecs) {
      try {
        const config = {
          codec,
          width: this.width % 2 === 0 ? this.width : this.width - 1,
          height: this.height % 2 === 0 ? this.height : this.height - 1,
          bitrate: EXPORT_VIDEO_BITRATE,
          framerate: this.framerate,
        };
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          selectedCodec = codec;
          console.log(`[VideoEncoder] Selected supported codec: ${codec}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const chunkData = new Uint8Array(chunk.byteLength);
        chunk.copyTo(chunkData);

        const annexBBuffer = avcToAnnexB(
          chunkData,
          chunk.type === 'key',
          metadata,
        );

        // Stream compressed H.264 raw packet directly to Tauri backend
        const p = exportApi.writeVideoChunk(annexBBuffer);
        this.pendingChunks.push(p);
      },
      error: (error) => {
        console.error('[VideoEncoder] Encoding error:', error);
      },
    });

    this.encoder.configure({
      codec: selectedCodec,
      width: this.width % 2 === 0 ? this.width : this.width - 1,
      height: this.height % 2 === 0 ? this.height : this.height - 1,
      bitrate: EXPORT_VIDEO_BITRATE,
      framerate: this.framerate,
      hardwareAcceleration: 'no-preference', // Automatically use GPU but fallback gracefully to software if needed
    });
  }

  /**
   * Submits a VideoFrame to the underlying encoder.
   */
  public encode(frame: VideoFrame): void {
    this.encoder.encode(frame);
  }

  /**
   * Flushes any buffered frames out of the encoder queue and awaits writing completion.
   */
  public async flush(): Promise<void> {
    console.log('[VideoEncoder] Flushing video encoder...');
    await this.encoder.flush();
    await Promise.all(this.pendingChunks);
    console.log('[VideoEncoder] All video frames written to backend.');
  }

  /**
   * Closes and cleans up encoder resources.
   */
  public close(): void {
    if (this.encoder && this.encoder.state !== 'closed') {
      this.encoder.close();
    }
  }
}
