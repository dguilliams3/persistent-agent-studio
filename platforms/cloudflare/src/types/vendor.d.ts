/**
 * Type declarations for third-party modules without TypeScript definitions.
 */

declare module 'upng-js' {
  interface DecodedPNG {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: Array<{ rect: { x: number; y: number; width: number; height: number }; delay: number; dispose: number; blend: number }>;
    tabs: Record<string, unknown>;
    data: ArrayBuffer;
  }

  function decode(buffer: ArrayBuffer | Buffer): DecodedPNG;
  function toRGBA8(png: DecodedPNG): ArrayBuffer[];
  function encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number, dels?: number[]): ArrayBuffer;

  export default { decode, toRGBA8, encode };
  export { decode, toRGBA8, encode };
}

declare module 'jpeg-js' {
  interface RawImageData {
    data: Buffer | Uint8Array;
    width: number;
    height: number;
  }

  interface EncodedJPEG {
    data: Buffer;
    width: number;
    height: number;
  }

  function encode(imgData: RawImageData, quality: number): EncodedJPEG;
  function decode(jpegData: Buffer | Uint8Array, opts?: { useTArray?: boolean; formatAsRGBA?: boolean; tolerantDecoding?: boolean; maxResolutionInMP?: number; maxMemoryUsageInMB?: number }): RawImageData;

  export default { encode, decode };
  export { encode, decode };
}
