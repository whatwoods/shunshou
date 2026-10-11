// Ordered dithering avoids propagating error between frames, keeping stationary regions stable.
export function ditherRgba(pixels: Uint8ClampedArray, width: number): Uint8ClampedArray {
  const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const result = new Uint8ClampedArray(pixels);
  for (let i = 0; i < result.length; i += 4) {
    const pixel = i / 4;
    const offset = (matrix[(Math.floor(pixel / width) % 4) * 4 + ((pixel % width) % 4)] - 7.5) * 1.4;
    result[i] += offset;
    result[i + 1] += offset;
    result[i + 2] += offset;
  }
  return result;
}
