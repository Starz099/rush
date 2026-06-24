import { RangeDemuxer } from './RangeDemuxer';

/**
 * Factory class to instantiate appropriate demuxers based on input file characteristics.
 * This pattern decouples playback engines from direct concrete demuxer classes.
 */
export class DemuxerFactory {
  /**
   * Instantiates and returns a new RangeDemuxer for the given file path.
   *
   * @param filePath Absolute path of the video or audio file.
   * @returns An instance of RangeDemuxer.
   */
  public static createDemuxer(filePath: string): RangeDemuxer {
    // Currently, all assets utilize the standard range request MP4Box demuxer.
    // In future versions, this can be expanded to check extensions (.webm, .mp3, etc.)
    // and return custom demuxer implementations (e.g. WebMDemuxer).
    return new RangeDemuxer(filePath);
  }
}
