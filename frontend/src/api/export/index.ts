import { startExport } from './start';
import { writeVideoChunk } from './writeVideoChunk';
import { writeAudioChunk } from './writeAudioChunk';
import { writeAudioFile } from './writeAudioFile';
import { finishExport } from './finish';
import { saveTestFrame } from './saveTestFrame';

export const exportApi = {
  start: startExport,
  writeVideoChunk,
  writeAudioChunk,
  writeAudioFile,
  finish: finishExport,
  saveTestFrame,
};
