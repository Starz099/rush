import * as MP4Box from 'mp4box';
import { invoke } from '@tauri-apps/api/core';

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

interface RangeResult {
  bytes: number[];
  file_start: number;
  total_length: number;
}

export class RangeDemuxer {
  private filePath: string;
  private mp4box: any;
  public samples: FrameInfo[] = [];
  public metadata: DemuxerMetadata | null = null;
  private disposed = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.mp4box = MP4Box.createFile();
  }

  /**
   * Initializes the demuxer by fetching only the metadata headers.
   */
  public async initialize(): Promise<DemuxerMetadata> {
    return new Promise(async (resolve, reject) => {
      // Set up MP4Box callbacks
      this.mp4box.onReady = (info: any) => {
        const videoTrack = info.videoTracks[0];
        if (!videoTrack) {
          return reject(new Error('No video track found in file'));
        }

        // Extract codec description for WebCodecs VideoDecoder (required for AVC H.264)
        let description: ArrayBuffer | undefined = undefined;
        try {
          const fileTrack = this.mp4box.getTrackById(videoTrack.id);
          const entry = fileTrack?.mdia?.minf?.stbl?.stsd?.entries?.[0];
          const avcC = entry?.avcC ?? entry?.hvcC;
          if (avcC) {
            const DataStream = (MP4Box as any).DataStream;
            if (DataStream) {
              const stream = new DataStream();
              avcC.write(stream);
              description = stream.buffer.slice(
                avcC.hdr_size ?? 8,
                stream.byteLength,
              );
            }
          }
        } catch (e) {
          console.warn(
            '[RangeDemuxer] Failed to extract codec description:',
            e,
          );
        }

        this.metadata = {
          codec: videoTrack.codec,
          width: videoTrack.video.width,
          height: videoTrack.video.height,
          durationSeconds: info.duration / info.timescale,
          timescale: videoTrack.timescale || info.timescale || 1,
          description,
        };

        // Retrieve samples list directly from parsed metadata
        const rawSamples = this.mp4box.getTrackSamplesInfo(videoTrack.id);
        if (!rawSamples || rawSamples.length === 0) {
          return reject(new Error('No samples found in video track'));
        }

        // Map MP4Box samples into our lightweight FrameInfo index list
        this.samples = rawSamples.map((s: any, idx: number) => {
          return {
            index: idx,
            cts: s.cts,
            duration: Math.max(0, s.duration || 0),
            offset: s.offset,
            size: s.size,
            isKeyframe: s.is_sync,
          };
        });

        console.log(
          `[RangeDemuxer] Successfully parsed metadata for ${this.filePath}. Total frames: ${this.samples.length}`,
        );
        resolve(this.metadata);
      };

      this.mp4box.onError = (e: any) => {
        console.error(`[RangeDemuxer] MP4Box error:`, e);
        reject(new Error(`MP4Box error: ${e}`));
      };

      // Fetch the metadata headers
      try {
        await this.parseMetadataHeaders();
      } catch (error) {
        console.error(
          `[RangeDemuxer] Failed to parse metadata headers:`,
          error,
        );
        reject(error);
      }
    });
  }

  /**
   * Helper to fetch a specific byte slice from the Tauri asset server
   */
  public async fetchRange(start: number, end: number): Promise<ArrayBuffer> {
    const length = end - start + 1;
    const result = await invoke<RangeResult>('read_asset_range', {
      filePath: this.filePath,
      offset: start,
      length: length,
    });
    return new Uint8Array(result.bytes).buffer;
  }

  /**
   * Fetches only the necessary header bytes to initialize MP4Box
   */
  private async parseMetadataHeaders() {
    console.log(`[RangeDemuxer] Fetching initial 100 KB header via Rust...`);
    // Step A: Fetch the first 100 KB (usually holds the moov atom/headers)
    const result = await invoke<RangeResult>('read_asset_range', {
      filePath: this.filePath,
      offset: 0,
      length: 102400,
    });

    console.log(
      `[RangeDemuxer] Header fetch result: bytes=${result.bytes ? result.bytes.length : 'null'}, file_start=${result.file_start}, total_length=${result.total_length}`,
    );

    const headerBuffer = new Uint8Array(result.bytes).buffer;
    (headerBuffer as any).fileStart = result.file_start;
    this.mp4box.appendBuffer(headerBuffer);

    // Step B: Check if MP4Box is ready. If not, the moov atom is likely at the end.
    // We will find and read the entire moov box natively using Rust.
    if (!this.metadata) {
      console.log(
        `[RangeDemuxer] Header did not contain moov atom. Locating and reading entire moov box via Rust...`,
      );
      const moovResult = await invoke<RangeResult>('read_moov_box', {
        filePath: this.filePath,
      });

      console.log(
        `[RangeDemuxer] Moov box fetch result: bytes=${moovResult.bytes ? moovResult.bytes.length : 'null'}, file_start=${moovResult.file_start}, total_length=${moovResult.total_length}`,
      );

      const moovBuffer = new Uint8Array(moovResult.bytes).buffer;
      (moovBuffer as any).fileStart = moovResult.file_start;

      this.mp4box.appendBuffer(moovBuffer);
      this.mp4box.flush();
    }
  }

  /**
   * Finds the nearest preceding keyframe and returns GOP frame configurations
   * along with the sliced binary buffers.
   */
  public async getGopForTime(timeInSeconds: number): Promise<{
    chunks: { chunk: EncodedVideoChunk; info: FrameInfo }[];
    targetTimestampMicros: number;
  }> {
    if (this.disposed) {
      throw new Error('Demuxer is disposed');
    }
    if (!this.metadata || this.samples.length === 0) {
      throw new Error('Demuxer not initialized');
    }

    const firstCts = this.samples[0]?.cts || 0;
    const targetCts = timeInSeconds * this.metadata.timescale + firstCts;
    let targetIdx = -1;

    // Boundary clamping to handle B-frame CTS offsets/shifts
    if (targetCts <= this.samples[0].cts) {
      targetIdx = 0;
    } else if (targetCts >= this.samples[this.samples.length - 1].cts) {
      targetIdx = this.samples.length - 1;
    } else {
      // Binary Search for the sample at the playhead position
      let low = 0;
      let high = this.samples.length - 1;
      while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        const sample = this.samples[mid];
        if (
          sample.cts <= targetCts &&
          sample.cts + sample.duration > targetCts
        ) {
          targetIdx = mid;
          break;
        } else if (sample.cts > targetCts) {
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }

      // Fallback: If binary search didn't find an exact match (e.g., CTS gap),
      // find the closest preceding sample
      if (targetIdx === -1) {
        for (let i = 0; i < this.samples.length; i++) {
          if (this.samples[i].cts > targetCts) {
            targetIdx = Math.max(0, i - 1);
            break;
          }
        }
      }
    }

    if (targetIdx === -1) {
      throw new Error(`No frame found at time: ${timeInSeconds}s`);
    }

    // Scan backwards to find the nearest Keyframe
    let keyframeIdx = targetIdx;
    while (keyframeIdx > 0 && !this.samples[keyframeIdx].isKeyframe) {
      keyframeIdx--;
    }

    // Calculate the byte range of the entire GOP (from Keyframe to target frame)
    const keyframe = this.samples[keyframeIdx];
    const targetFrame = this.samples[targetIdx];
    const startByte = keyframe.offset;
    const endByte = targetFrame.offset + targetFrame.size - 1;

    // Fetch only this GOP slice from disk
    const gopBuffer = await this.fetchRange(startByte, endByte);

    // Slice the GOP buffer into individual frames and wrap them as EncodedVideoChunks
    const chunks = [];
    for (let i = keyframeIdx; i <= targetIdx; i++) {
      const frameInfo = this.samples[i];
      const relativeOffset = frameInfo.offset - startByte;

      // Slice out the raw frame payload bytes from our fetched buffer
      const frameData = new Uint8Array(
        gopBuffer,
        relativeOffset,
        frameInfo.size,
      );

      const chunk = new EncodedVideoChunk({
        type: frameInfo.isKeyframe ? 'key' : 'delta',
        timestamp: Math.round(
          ((frameInfo.cts - firstCts) * 1e6) / this.metadata.timescale,
        ),
        duration: Math.max(
          0,
          Math.round((frameInfo.duration * 1e6) / this.metadata.timescale),
        ),
        data: frameData,
      });

      chunks.push({ chunk, info: frameInfo });
    }

    const targetTimestampMicros = Math.round(
      ((targetFrame.cts - firstCts) * 1e6) / this.metadata.timescale,
    );

    return { chunks, targetTimestampMicros };
  }

  /**
   * Fetches and wraps a single frame as an EncodedVideoChunk.
   */
  public async getSingleFrame(index: number): Promise<EncodedVideoChunk> {
    if (this.disposed) {
      throw new Error('Demuxer is disposed');
    }
    if (!this.metadata || this.samples.length === 0) {
      throw new Error('Demuxer not initialized');
    }

    const sample = this.samples[index];
    if (!sample) {
      throw new Error(`Sample index ${index} out of bounds`);
    }

    const firstCts = this.samples[0]?.cts || 0;
    const buffer = await this.fetchRange(
      sample.offset,
      sample.offset + sample.size - 1,
    );
    const frameData = new Uint8Array(buffer);

    return new EncodedVideoChunk({
      type: sample.isKeyframe ? 'key' : 'delta',
      timestamp: Math.round(
        ((sample.cts - firstCts) * 1e6) / this.metadata.timescale,
      ),
      duration: Math.max(
        0,
        Math.round((sample.duration * 1e6) / this.metadata.timescale),
      ),
      data: frameData,
    });
  }

  public dispose() {
    this.disposed = true;
    this.samples = [];
    this.mp4box = null;
  }
}
