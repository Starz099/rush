/**
 * Converts a size-prefixed AVC/H.264 NAL unit sequence (mp4 format)
 * into Annex B start-code-prefixed format, prepending SPS/PPS headers on keyframes.
 */
export function avcToAnnexB(
  chunkData: Uint8Array,
  isKeyframe: boolean,
  metadata?: EncodedVideoChunkMetadata,
): Uint8Array {
  let description = metadata?.decoderConfig?.description;
  let header: Uint8Array | null = null;

  if (isKeyframe && description) {
    const descView = new DataView(description as ArrayBuffer);
    if (descView.byteLength >= 7) {
      let pos = 5;
      const numSps = descView.getUint8(pos) & 0x1f;
      pos += 1;

      const spsList: Uint8Array[] = [];
      for (let i = 0; i < numSps; i++) {
        const spsLen = descView.getUint16(pos);
        pos += 2;
        const sps = new Uint8Array(description as ArrayBuffer, pos, spsLen);
        spsList.push(sps);
        pos += spsLen;
      }

      const numPps = descView.getUint8(pos);
      pos += 1;

      const ppsList: Uint8Array[] = [];
      for (let i = 0; i < numPps; i++) {
        const ppsLen = descView.getUint16(pos);
        pos += 2;
        const pps = new Uint8Array(description as ArrayBuffer, pos, ppsLen);
        ppsList.push(pps);
        pos += ppsLen;
      }

      // Combine SPS and PPS into Annex B headers
      let totalSize = 0;
      for (const sps of spsList) totalSize += 4 + sps.length;
      for (const pps of ppsList) totalSize += 4 + pps.length;

      header = new Uint8Array(totalSize);
      let headerPos = 0;
      const startCode = new Uint8Array([0, 0, 0, 1]);

      for (const sps of spsList) {
        header.set(startCode, headerPos);
        headerPos += 4;
        header.set(sps, headerPos);
        headerPos += sps.length;
      }
      for (const pps of ppsList) {
        header.set(startCode, headerPos);
        headerPos += 4;
        header.set(pps, headerPos);
        headerPos += pps.length;
      }
    }
  }

  // Loop through NAL units and swap 4-byte length prefix for 4-byte start codes [0,0,0,1]
  let pos = 0;
  const segments: Uint8Array[] = [];
  if (header) {
    segments.push(header);
  }

  while (pos < chunkData.length) {
    if (pos + 4 > chunkData.length) {
      break; // Guard against malformed trailing bytes
    }

    const length =
      (chunkData[pos] << 24) |
      (chunkData[pos + 1] << 16) |
      (chunkData[pos + 2] << 8) |
      chunkData[pos + 3];

    if (pos + 4 + length > chunkData.length) {
      break;
    }

    const nalu = new Uint8Array(4 + length);
    nalu.set([0, 0, 0, 1], 0);
    nalu.set(chunkData.subarray(pos + 4, pos + 4 + length), 4);
    segments.push(nalu);

    pos += 4 + length;
  }

  // Combine SPS, PPS, and all key/delta frame segments into one contiguous Annex B buffer
  let totalLen = 0;
  for (const seg of segments) {
    totalLen += seg.length;
  }

  const output = new Uint8Array(totalLen);
  let offset = 0;
  for (const seg of segments) {
    output.set(seg, offset);
    offset += seg.length;
  }

  return output;
}
