declare module '@e965/xlsx/dist/cpexcel.full.mjs' {
  export const utils: {
    decode(codepage: number, bytes: number[] | Uint8Array): string;
    encode(codepage: number, text: string): Uint8Array;
  };
}
