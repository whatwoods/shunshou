declare module 'libheif-js/libheif-wasm/libheif.js' {
  const factory: (options: { wasmBinary: ArrayBuffer }) => Promise<{
    HeifDecoder: new () => {
      decode: (bytes: Uint8Array) => {
        get_width: () => number;
        get_height: () => number;
        display: (data: ImageData, callback: (result: ImageData | null) => void) => void;
        free: () => void;
      }[];
      decoder: { delete: () => void };
    };
  }>;
  export default factory;
}
declare module 'gifenc' {
  export function quantize(data: Uint8Array | Uint8ClampedArray, count: number): number[][];
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: number[][]): Uint8Array;
  export function GIFEncoder(): {
    writeFrame: (
      data: Uint8Array,
      width: number,
      height: number,
      options: { palette: number[][]; delay?: number; repeat?: number }
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array<ArrayBuffer>;
  };
}
