// Pure instruction-data encoding for the Zorr program (no @solana/kit import,
// so it's fast and unit-testable).

// Anchor discriminator for `capture_tile` (from onchain/idl/zorr.json).
export const CAPTURE_TILE_DISCRIMINATOR = new Uint8Array([4, 55, 84, 232, 142, 81, 238, 39])

/** Little-endian signed 64-bit encoding (Anchor i64 arg layout). */
export function i64le(n: number): Uint8Array {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigInt64(0, BigInt(Math.trunc(n)), true)
  return b
}

/** `capture_tile(tile_x, tile_y)` instruction data: 8-byte disc + two i64. */
export function encodeCaptureTileData(tileX: number, tileY: number): Uint8Array {
  return new Uint8Array([...CAPTURE_TILE_DISCRIMINATOR, ...i64le(tileX), ...i64le(tileY)])
}
