import { base64ToBytes, hexSeed, parseVrfSeed, scopeFromString } from '../vrf-seed'

describe('hexSeed', () => {
  it('encodes 32 bytes to 64 lowercase hex chars', () => {
    const bytes = new Uint8Array(32).map((_, i) => i)
    const hex = hexSeed(bytes)
    expect(hex).toHaveLength(64)
    expect(hex.startsWith('000102030405')).toBe(true)
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true)
  })

  it('is wire-safe (matches the battle protocol SEED_OK charset)', () => {
    const hex = hexSeed(new Uint8Array([255, 0, 171, 16]))
    expect(/^[A-Za-z0-9_-]+$/.test(hex)).toBe(true)
    expect(hex).toBe('ff00ab10')
  })
})

describe('scopeFromString', () => {
  it('is deterministic and 16 bytes', () => {
    const a = scopeFromString('room-ABCD')
    const b = scopeFromString('room-ABCD')
    expect(a).toEqual(b)
    expect(a).toHaveLength(16)
  })

  it('differs for different inputs', () => {
    expect(scopeFromString('room-1')).not.toEqual(scopeFromString('room-2'))
  })
})

describe('base64ToBytes', () => {
  it('decodes standard base64 including padding', () => {
    // "Man" -> TWFu ; "Ma" -> TWE= ; "M" -> TQ==
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110])
    expect(Array.from(base64ToBytes('TWE='))).toEqual([77, 97])
    expect(Array.from(base64ToBytes('TQ=='))).toEqual([77])
  })

  it('decodes a run of A (zero bytes)', () => {
    // 8 base64 'A' chars -> 6 zero bytes.
    expect(Array.from(base64ToBytes('AAAAAAAA'))).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('parseVrfSeed', () => {
  function buildAccount(seed: number[], counter: number, fulfilled: boolean): Uint8Array {
    const d = new Uint8Array(49)
    d.set([137, 156, 245, 171, 181, 209, 145, 47], 0) // discriminator
    d.set(seed, 8)
    // Little-endian u64 via division — JS `>>` is 32-bit and would wrap.
    let c = counter
    for (let i = 0; i < 8; i++) {
      d[40 + i] = c & 0xff
      c = Math.floor(c / 256)
    }
    d[48] = fulfilled ? 1 : 0
    return d
  }

  it('returns null for undersized data', () => {
    expect(parseVrfSeed(new Uint8Array(10))).toBeNull()
  })

  it('extracts seed, counter, and fulfilled flag', () => {
    const seed = Array.from({ length: 32 }, (_, i) => (i * 7) % 256)
    const acct = parseVrfSeed(buildAccount(seed, 3, true))
    expect(acct).not.toBeNull()
    expect(Array.from(acct!.seed)).toEqual(seed)
    expect(acct!.counter).toBe(3)
    expect(acct!.fulfilled).toBe(true)
  })

  it('reads fulfilled=false before the oracle responds', () => {
    const acct = parseVrfSeed(buildAccount(new Array(32).fill(0), 0, false))
    expect(acct!.fulfilled).toBe(false)
  })
})
