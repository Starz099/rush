import { RangeDemuxer } from '../demuxers/RangeDemuxer';
import { DemuxerFactory } from '../demuxers/DemuxerFactory';

export class SimpleClipDecoder {
  private demuxer: RangeDemuxer;
  private decoder!: VideoDecoder;
  private decodedFrames: VideoFrame[] = [];

  constructor(filePath: string) {
    this.demuxer = DemuxerFactory.createDemuxer(filePath);
  }

  public async initialize() {
    await this.demuxer.initialize();

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.decodedFrames.push(frame);
      },
      error: (e) => {
        console.error('[SimpleClipDecoder] Native VideoDecoder error:', e);
      },
    });

    if (this.demuxer.metadata) {
      this.decoder.configure({
        codec: this.demuxer.metadata.codec,
        codedWidth: this.demuxer.metadata.width,
        codedHeight: this.demuxer.metadata.height,
        description: this.demuxer.metadata.description,
        hardwareAcceleration: 'prefer-hardware',
      });
    }
  }

  public async getKeyframeNear(
    sourceTimeSeconds: number,
  ): Promise<VideoFrame | null> {
    this.clearFrames();

    if (!this.demuxer.metadata || this.demuxer.samples.length === 0) {
      return null;
    }

    const firstCts = this.demuxer.samples[0]?.cts || 0;
    const targetCts =
      sourceTimeSeconds * this.demuxer.metadata.timescale + firstCts;

    // Find keyframe with CTS closest to targetCts
    let bestSample = this.demuxer.samples[0];
    let minDiff = Infinity;

    for (const sample of this.demuxer.samples) {
      if (sample.isKeyframe) {
        const diff = Math.abs(sample.cts - targetCts);
        if (diff < minDiff) {
          minDiff = diff;
          bestSample = sample;
        }
      }
    }

    // Fetch and decode only this single keyframe chunk
    const chunk = await this.demuxer.getSingleFrame(bestSample.index);
    this.decoder.decode(chunk);

    // Wait for the decoder callback (should resolve almost instantly since it's a keyframe)
    const targetTimestampMicros = chunk.timestamp;
    const startTime = performance.now();
    const timeoutMs = 800;
    while (performance.now() - startTime < timeoutMs) {
      const found = this.decodedFrames.some(
        (f) => Math.abs(f.timestamp - targetTimestampMicros) < 33000,
      );
      if (found) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    if (this.decodedFrames.length > 0) {
      const frame = this.decodedFrames[0];
      this.decodedFrames = this.decodedFrames.filter((f) => f !== frame);
      this.clearFrames();
      return frame;
    }

    return null;
  }

  private clearFrames() {
    for (const frame of this.decodedFrames) {
      frame.close();
    }
    this.decodedFrames = [];
  }

  public dispose() {
    this.clearFrames();
    try {
      this.decoder.close();
    } catch (e) {
      // Ignore if already closed
    }
    this.demuxer.dispose();
  }
}
