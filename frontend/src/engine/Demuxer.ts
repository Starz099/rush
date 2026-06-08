import * as MP4Box from 'mp4box'
import { invoke } from '@tauri-apps/api/core'

export class VideoDemuxer {
  private mp4boxfile: any
  private decoder: VideoDecoder
  private filePath: string
  private decoderConfigured = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.mp4boxfile = MP4Box.createFile()
    this.decoder = new VideoDecoder({
      output: (frame) => {
        console.log(
          `Decoded Frame at ${frame.timestamp}ms. Size: ${frame.codedWidth}x${frame.codedHeight}`,
        )
        frame.close()
      },
      error: (e) => console.error('Decoder error:', e),
    })
  }

  public async initialize(): Promise<any> {
    return new Promise((resolve, reject) => {
      let videoTrack: any

      // Metadata
      this.mp4boxfile.onReady = (info: any) => {
        videoTrack = info.videoTracks[0]
        if (!videoTrack) return reject('No video track found')
        // Start extraction
        this.mp4boxfile.setExtractionOptions(videoTrack.id, null, {
          nbSamples: 100,
        })
        this.mp4boxfile.start()
        // Return basic metadata
        resolve({
          codec: videoTrack.codec,
          timescale: info.timescale,
          duration: info.duration,
        })
      }

      // Samples
      this.mp4boxfile.onSamples = (
        _track_id: number,
        _user: any,
        samples: any[],
      ) => {
        // Decode
        for (const sample of samples) {
          if (!this.decoderConfigured) {
            if (!sample.is_sync) {
              continue
            }

            this.decoder.configure({
              codec: videoTrack.codec,
              codedWidth: videoTrack.video.width,
              codedHeight: videoTrack.video.height,
              ...(this.getDecoderDescription(sample) ?? {}),
            })
            this.decoderConfigured = true
          }

          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: sample.cts, // The exact time this frame appears
            duration: sample.duration,
            data: sample.data, // The raw H.264 binary bytes
          })

          // Push to decoder
          this.decoder.decode(chunk)
        }
      }

      this.mp4boxfile.onError = (e: string) => reject(e)

      this.fetchAndFeed()
    })
  }

  private async fetchAndFeed() {
    try {
      const fileBytes = await invoke<number[]>('read_asset_bytes', {
        filePath: this.filePath,
      })
      const buffer = new Uint8Array(fileBytes).buffer
      ;(buffer as any).fileStart = 0

      this.mp4boxfile.appendBuffer(buffer)
      this.mp4boxfile.flush()
    } catch (error) {
      console.error('Failed to read local file:', error)
    }
  }

  private getDecoderDescription(
    sample: any,
  ): { description?: ArrayBuffer } | null {
    const avcConfiguration = sample?.description?.avcC
    if (!avcConfiguration) return null

    const DataStream = (MP4Box as any).DataStream
    if (!DataStream) return null

    const stream = new DataStream()
    avcConfiguration.write(stream)

    return {
      description: stream.buffer.slice(
        avcConfiguration.hdr_size ?? 8,
        stream.byteLength,
      ),
    }
  }
}
