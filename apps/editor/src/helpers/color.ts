export function hexToRgbaClearColor(hex: string) {
  const rgba = hexToRgbaArray(hex);
  return { r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3] };
}

export function hexToRgbaArray(hex: string): [number, number, number, number] {
  if (!hex) return [0, 0, 0, 1];
  let cleanHex = hex.replace(/^#/, '');

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (cleanHex.length !== 6 && cleanHex.length !== 8) {
    return [0, 0, 0, 1];
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  const a =
    cleanHex.length === 8 ? parseInt(cleanHex.substring(6, 8), 16) / 255 : 1;

  return [r, g, b, a];
}
