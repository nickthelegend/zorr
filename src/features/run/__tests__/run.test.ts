import { formatDuration, formatPace, haversineKm, tileAreaKm2 } from '../use-run-session'

describe('run helpers', () => {
  it('haversineKm ≈ 111 km per degree of latitude', () => {
    const d = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })

  it('haversineKm is 0 for the same point', () => {
    expect(haversineKm({ latitude: 17, longitude: 78 }, { latitude: 17, longitude: 78 })).toBeCloseTo(0)
  })

  it('tileAreaKm2 is a small positive area (~55m square)', () => {
    const a = tileAreaKm2(17.4)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(0.01)
  })

  it('formatDuration formats mm:ss and h:mm:ss', () => {
    expect(formatDuration(5)).toBe('00:05')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('formatPace returns — under ~0 distance, min:sec otherwise', () => {
    expect(formatPace(0, 100)).toBe('—')
    expect(formatPace(1, 300)).toBe('5:00')
    expect(formatPace(2, 600)).toBe('5:00')
  })
})
