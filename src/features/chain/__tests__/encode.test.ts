import { CAPTURE_TILE_DISCRIMINATOR, encodeCaptureTileData, i64le } from '../encode'

describe('on-chain encoding', () => {
  it('i64le encodes little-endian signed 64-bit', () => {
    expect(Array.from(i64le(1))).toEqual([1, 0, 0, 0, 0, 0, 0, 0])
    expect(Array.from(i64le(256))).toEqual([0, 1, 0, 0, 0, 0, 0, 0])
    expect(Array.from(i64le(-1))).toEqual([255, 255, 255, 255, 255, 255, 255, 255])
  })

  it('encodeCaptureTileData = 8-byte discriminator + two i64 (24 bytes)', () => {
    const data = encodeCaptureTileData(42, 77)
    expect(data).toHaveLength(24)
    expect(Array.from(data.slice(0, 8))).toEqual(Array.from(CAPTURE_TILE_DISCRIMINATOR))
    expect(Array.from(data.slice(8, 16))).toEqual([42, 0, 0, 0, 0, 0, 0, 0])
    expect(Array.from(data.slice(16, 24))).toEqual([77, 0, 0, 0, 0, 0, 0, 0])
  })

  it('handles negative tile coordinates', () => {
    const data = encodeCaptureTileData(-1, -1)
    expect(Array.from(data.slice(8, 16))).toEqual([255, 255, 255, 255, 255, 255, 255, 255])
  })
})
