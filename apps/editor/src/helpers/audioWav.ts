export const audioBufferToWav = (buffer: AudioBuffer): Uint8Array => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;

  // Calculate file sizes
  const bytesPerSample = 2; // 16-bit audio uses 2 bytes
  const blockAlign = numChannels * bytesPerSample; // 4 bytes for stereo (2ch * 2bytes)
  const dataSize = numSamples * blockAlign;
  const totalSize = 44 + dataSize; // Header (44) + Data size

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Helper to write text strings into binary space
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  // Write the WAV Header (First 44 bytes)
  writeString(0, 'RIFF'); // Container format label
  view.setUint32(4, 36 + dataSize, true); // Chunk size (little-endian)
  writeString(8, 'WAVE'); // File type label
  writeString(12, 'fmt '); // Format section label
  view.setUint32(16, 16, true); // Format section size (16 bytes)
  view.setUint16(20, 1, true); // Audio format code (1 = Uncompressed PCM)
  view.setUint16(22, numChannels, true); // 2 Channels (Stereo)
  view.setUint32(24, sampleRate, true); // Sample rate (e.g. 48000)
  view.setUint32(28, sampleRate * blockAlign, true); // Byte rate (bytes per second)
  view.setUint16(32, blockAlign, true); // Frame alignment size
  view.setUint16(34, 16, true); // Bits per sample (16-bit)
  writeString(36, 'data'); // Data section label
  view.setUint32(40, dataSize, true); // Data section size

  // Get raw float channels from the AudioBuffer
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  // Interleave and convert floats to 16-bit PCM Integers
  let offset = 44; // Start writing data after the header
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];

      // Clamp values to prevent static distortion
      sample = Math.max(-1.0, Math.min(1.0, sample));

      // Convert Float (-1.0 to 1.0) to 16-bit Integer (-32768 to 32767)
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      view.setInt16(offset, pcmSample, true); // Write sample (little-endian)
      offset += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
};
