const DEBUG_LOG = false;

export class VideoDecoderWrapper {
  private decoder: VideoDecoder;
  private isConfigured = false;
  private onFrameDecoded: (frame: VideoFrame) => void;

  private activeConfig: VideoDecoderConfig | null = null;

  constructor(onFrameDecoded: (frame: VideoFrame) => void) {
    this.onFrameDecoded = onFrameDecoded;

    // Initialize the WebCodecs VideoDecoder
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        if (DEBUG_LOG) {
          console.log(
            `[VideoDecoder] Decoded frame timestamp=${(frame.timestamp / 1e6).toFixed(3)}s`,
          );
        }
        // This callback is triggered when the GPU finishes decoding a frame
        this.onFrameDecoded(frame);
      },
      error: (e) => {
        console.error('[VideoDecoder] Hardware decoding error:', e);
      },
    });
  }

  /**
   * Configures the decoder with video dimensions and codec headers.
   */
  public configure(
    codec: string,
    width: number,
    height: number,
    description?: ArrayBuffer,
  ) {
    const config: VideoDecoderConfig = {
      codec,
      codedWidth: width,
      codedHeight: height,
      // 'prefer-hardware' requests the browser to use GPU decoding rather than CPU.
      hardwareAcceleration: 'prefer-hardware',
    };

    if (description) {
      config.description = description;
    }

    this.activeConfig = config;

    try {
      this.decoder.configure(config);
      this.isConfigured = true;
    } catch (error) {
      console.error('[VideoDecoder] Failed to configure decoder:', error);
      throw error;
    }
  }

  /**
   * Sends a compressed chunk of a frame to the GPU for decoding.
   */
  public decode(chunk: EncodedVideoChunk) {
    if (!this.isConfigured) {
      if (this.activeConfig) {
        try {
          this.decoder.configure(this.activeConfig);
          this.isConfigured = true;
        } catch (error) {
          console.error(
            '[VideoDecoder] Failed to re-configure decoder on decode:',
            error,
          );
          return;
        }
      } else {
        console.warn(
          '[VideoDecoder] Cannot decode: Decoder not configured and no cached configuration',
        );
        return;
      }
    }
    this.decoder.decode(chunk);
  }

  /**
   * Resets the decoder, flushing the pipeline.
   */
  public reset() {
    this.decoder.reset();
    this.isConfigured = false;
  }

  /**
   * Waits until all currently sent decodes are fully finished.
   */
  public async flush(): Promise<void> {
    if (this.isConfigured) {
      await this.decoder.flush();
    }
  }

  /**
   * Shuts down the decoder.
   */
  public close() {
    if (this.decoder.state !== 'closed') {
      this.decoder.close();
    }
    this.isConfigured = false;
  }
}
