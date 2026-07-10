// Generate a pixel-art sprite for every Genesis beast via Pollinations' free
// image endpoint (no API key / pollen needed). Writes assets/beasts/<seed>.jpg
// in the app, plus assets/beasts/index.json (a seed→file + species/element
// fallback map the app uses to resolve an image for ANY beast — NFT, starter,
// or bot). Resume-safe: existing non-empty files are skipped.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const genesis = JSON.parse(fs.readFileSync(path.join(here, '..', 'out', 'genesis.json'), 'utf8'))
const outDir = path.join(here, '..', '..', 'assets', 'beasts')
fs.mkdirSync(outDir, { recursive: true })

// Element → visual theme for the prompt.
const THEME = {
  fire: 'fiery red and orange flames, molten embers, glowing lava',
  water: 'deep aquatic blue, flowing water, waves and foam',
  earth: 'rocky stone and moss, green and earthy brown, crystals',
  wind: 'aerial teal and white, swirling wind and feathers',
  light: 'radiant golden holy light, glowing halo, celestial',
  dark: 'shadowy purple and black, dark ominous aura, wisps',
}
// Rarity → aura / detail level.
const AURA = {
  Common: 'clean simple design',
  Rare: 'a subtle blue magical aura, refined details',
  Epic: 'a glowing purple epic aura, ornate armored details',
  Legendary: 'a radiant golden legendary aura, majestic ornate crown, intricate highly-detailed masterpiece',
}

const noun = (name) => name.split(' ').pop().toLowerCase()

function promptFor(b) {
  const p = `pixel art sprite of ${b.name}, a ${noun(b.name)} monster of the ${b.element} element, ${THEME[b.element]}, ${AURA[b.rarity]}, 16-bit retro JRPG creature, centered full-body facing forward, solid dark charcoal background, crisp clean pixels, vibrant, game asset, no text no watermark`
  return encodeURIComponent(p)
}

// Deterministic per-beast image seed so re-runs reproduce the same art.
const imgSeed = (b) => Math.abs([...b.seed].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)) % 1_000_000

async function fetchOne(b) {
  const file = path.join(outDir, `${b.seed}.jpg`)
  if (fs.existsSync(file) && fs.statSync(file).size > 2000) return { seed: b.seed, skipped: true }
  const url = `https://image.pollinations.ai/prompt/${promptFor(b)}?width=384&height=384&nologo=true&model=flux&seed=${imgSeed(b)}`
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (res.status === 429) throw new Error('HTTP 429')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 2000) throw new Error(`tiny ${buf.length}b`)
      fs.writeFileSync(file, buf)
      return { seed: b.seed, bytes: buf.length }
    } catch (e) {
      if (attempt === 6) return { seed: b.seed, error: String(e.message || e) }
      // 429 needs a real cool-down; back off hard (5s, 10s, 20s, 40s, 80s).
      await new Promise((r) => setTimeout(r, 5000 * 2 ** (attempt - 1)))
    }
  }
}

// Small concurrency pool (the free endpoint throttles under heavy parallelism).
async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
        const r = out[idx]
        console.log(`[${idx + 1}/${items.length}] ${r.seed} ${r.skipped ? 'skip' : r.error ? 'ERR ' + r.error : r.bytes + 'b'}`)
        // Pace requests to stay under the free endpoint's rate limit.
        if (!r.skipped) await new Promise((rr) => setTimeout(rr, 2500))
      }
    }),
  )
  return out
}

const results = await pool(genesis, 1, fetchOne)
const ok = results.filter((r) => r.bytes || r.skipped)
const failed = results.filter((r) => r.error)

// Build the lookup index: exact seed → file, plus element+noun and element
// fallbacks (so bots/starters resolve to a matching-species sprite).
const bySeed = {}
const bySpecies = {}
const byElement = {}
for (const b of genesis) {
  if (!(fs.existsSync(path.join(outDir, `${b.seed}.jpg`)))) continue
  bySeed[b.seed] = `${b.seed}.jpg`
  const sp = `${b.element}-${noun(b.name)}`
  if (!bySpecies[sp]) bySpecies[sp] = `${b.seed}.jpg`
  if (!byElement[b.element]) byElement[b.element] = `${b.seed}.jpg`
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ bySeed, bySpecies, byElement }, null, 2))

console.log(`\nDone. ${ok.length}/${genesis.length} present, ${failed.length} failed.`)
if (failed.length) console.log('Failed:', failed.map((f) => f.seed).join(', '))
console.log(`Index: ${Object.keys(bySeed).length} seeds, ${Object.keys(bySpecies).length} species, ${Object.keys(byElement).length} elements → ${path.join(outDir, 'index.json')}`)
