// Procedural "neon cartography" trading-card art — one unique 512×720 SVG per
// beast, fully seeded (constellation, orb facets, tick rotation all derive from
// the seed) so no two Guardians look alike. Deterministic + dependency-free.
import { ELEMENT_META } from './beast-traits.mjs'

const RARITY = {
  Common: { color: '#94A3B8', ring: 1 },
  Rare: { color: '#38BDF8', ring: 2 },
  Epic: { color: '#A855F7', ring: 3 },
  Legendary: { color: '#FBBF24', ring: 4 },
}

function prng(seedStr) {
  let h = 0x811c9dc5
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function beastSvg(beast) {
  const el = ELEMENT_META[beast.element]
  const rar = RARITY[beast.rarity]
  const c = el.color
  const rnd = prng(beast.seed)
  const W = 512
  const H = 720
  const cx = W / 2
  const cy = 300

  // Seeded constellation of stars in the emblem field.
  let stars = ''
  const nStars = 10 + Math.floor(rnd() * 10)
  const pts = []
  for (let i = 0; i < nStars; i++) {
    const x = 70 + rnd() * (W - 140)
    const y = 120 + rnd() * 320
    const r = 1 + rnd() * 2.4
    pts.push([x, y])
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`
  }
  // Link nearest stars into faint constellation lines.
  let lines = ''
  for (let i = 0; i < pts.length; i++) {
    let best = -1
    let bd = 1e9
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue
      const d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2
      if (d < bd) { bd = d; best = j }
    }
    if (best > i) lines += `<line x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}" x2="${pts[best][0].toFixed(1)}" y2="${pts[best][1].toFixed(1)}" stroke="${c}" stroke-width="1" opacity="0.28"/>`
  }

  // Central faceted orb — a seeded polygon.
  const sides = 5 + Math.floor(rnd() * 4)
  const rot = rnd() * Math.PI
  const R = 96
  let poly = ''
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2
    const rr = R * (0.82 + rnd() * 0.18)
    poly += `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)} `
  }

  // Compass ticks around the orb (echoes the app's LevelRing).
  let ticks = ''
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const r1 = 128
    const r2 = i % 12 === 0 ? 116 : 122
    ticks += `<line x1="${(cx + Math.cos(a) * r2).toFixed(1)}" y1="${(cy + Math.sin(a) * r2).toFixed(1)}" x2="${(cx + Math.cos(a) * r1).toFixed(1)}" y2="${(cy + Math.sin(a) * r1).toFixed(1)}" stroke="${c}" stroke-width="${i % 12 === 0 ? 2 : 1}" opacity="${i % 12 === 0 ? 0.7 : 0.3}"/>`
  }

  const st = beast.stats
  const maxStat = Math.max(st.attack, st.defense, st.speed, st.magic, 100)
  const bar = (label, v, y) => {
    const w = (v / maxStat) * 150
    return `<text x="40" y="${y - 6}" fill="#8a8a9a" font-family="monospace" font-size="12" letter-spacing="1">${label}</text>
      <rect x="90" y="${y - 16}" width="150" height="8" rx="4" fill="rgba(255,255,255,0.08)"/>
      <rect x="90" y="${y - 16}" width="${w.toFixed(0)}" height="8" rx="4" fill="${c}"/>
      <text x="252" y="${y - 6}" fill="#cfcfe0" font-family="monospace" font-size="12">${v}</text>`
  }

  // Rarity frame — thickness by rarity.
  let frame = `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="22" fill="none" stroke="${rar.color}" stroke-width="${rar.ring}" opacity="0.9"/>`
  if (beast.rarity === 'Legendary') frame += `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="18" fill="none" stroke="${rar.color}" stroke-width="1" opacity="0.4"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="${c}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#05050b" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0.12"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="24" fill="#05050b"/>
  <rect width="${W}" height="${H}" rx="24" fill="url(#glow)"/>
  ${lines}${stars}${ticks}
  <polygon points="${poly.trim()}" fill="url(#orb)" stroke="${c}" stroke-width="2" opacity="0.95"/>
  <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="64">${el.glyph}</text>

  <text x="40" y="66" fill="#6a6a7a" font-family="monospace" font-size="13" letter-spacing="4">ZORR BEASTS · GENESIS</text>
  <rect x="40" y="80" width="${18 + beast.rarity.length * 9}" height="24" rx="12" fill="none" stroke="${rar.color}" opacity="0.8"/>
  <text x="${49}" y="97" fill="${rar.color}" font-family="monospace" font-size="12" letter-spacing="1">${beast.rarity.toUpperCase()}</text>
  <text x="${W - 40}" y="97" text-anchor="end" fill="${c}" font-family="monospace" font-size="13" letter-spacing="2">${el.label.toUpperCase()}</text>

  <text x="${cx}" y="490" text-anchor="middle" fill="#ffffff" font-family="'Arial Black','Helvetica',sans-serif" font-weight="900" font-size="34">${esc(beast.name)}</text>
  <text x="${cx}" y="516" text-anchor="middle" fill="#8a8a9a" font-family="monospace" font-size="13" letter-spacing="2">POWER ${beast.power} · ${beast.maxHealth} HP</text>

  ${bar('ATK', st.attack, 566)}
  ${bar('DEF', st.defense, 596)}
  ${bar('SPD', st.speed, 626)}
  ${bar('MAG', st.magic, 656)}

  <text x="40" y="694" fill="#4a4a5a" font-family="monospace" font-size="10">${esc(beast.seed)}</text>
  <text x="${W - 40}" y="694" text-anchor="end" fill="#4a4a5a" font-family="monospace" font-size="10">SOLANA · METAPLEX CORE</text>
</svg>`
}
