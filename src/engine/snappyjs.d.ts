// snappyjs ships no types; only the two functions hap.ts actually calls.
declare module 'snappyjs' {
  export function uncompress(compressed: Uint8Array, maxLength: number): Uint8Array
  export function compress(uncompressed: Uint8Array): Uint8Array
}
