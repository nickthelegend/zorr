// Mint the Genesis 48 as real Metaplex Core NFTs on Solana devnet.
// Per beast: render SVG → upload to Arweave (Irys) → build + upload metadata
// (the SEED is the key trait, so the app derives identical battle stats) →
// mint a Core asset into the "Zorr Beasts" collection. Resume-safe: re-running
// skips anything already in out/manifest.json.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { create, createCollection, fetchCollection, mplCore } from '@metaplex-foundation/mpl-core'
import { createGenericFile, generateSigner, keypairIdentity } from '@metaplex-foundation/umi'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'

import { ELEMENT_META } from './beast-traits.mjs'
import { beastSvg } from './art.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = (f) => path.join(here, '..', 'out', f)
const read = (f, d) => (fs.existsSync(out(f)) ? JSON.parse(fs.readFileSync(out(f), 'utf8')) : d)
const write = (f, o) => fs.writeFileSync(out(f), JSON.stringify(o, null, 2))

const secret = JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/zorr.json`, 'utf8'))
const umi = createUmi('https://api.devnet.solana.com').use(mplCore()).use(irysUploader({ address: 'https://devnet.irys.xyz' }))
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(secret))))
console.log('Authority:', umi.identity.publicKey)

const uploadJson = (obj, name) =>
  umi.uploader.upload([createGenericFile(new TextEncoder().encode(JSON.stringify(obj)), name, { contentType: 'application/json' })]).then((r) => r[0])
const uploadSvg = (svg, name) =>
  umi.uploader.upload([createGenericFile(new TextEncoder().encode(svg), name, { contentType: 'image/svg+xml' })]).then((r) => r[0])

// ---- Collection (create once, reuse) ----
let coll = read('collection.json', null)
if (!coll) {
  console.log('Creating "Zorr Beasts" collection…')
  const collImage = await uploadSvg(
    beastSvg({ seed: 'zorr-collection', name: 'Zorr Beasts', element: 'dark', rarity: 'Legendary', power: 99, maxHealth: 400, stats: { attack: 99, defense: 99, speed: 99, magic: 99 } }),
    'zorr-beasts.svg',
  )
  const collUri = await uploadJson(
    { name: 'Zorr Beasts', symbol: 'ZORR', description: 'Genesis Guardians for Zorr — a GPS territory game on Solana + MagicBlock. Traits are sealed by the on-chain seed; drops are VRF-fair.', image: collImage },
    'zorr-collection.json',
  )
  const collection = generateSigner(umi)
  await createCollection(umi, { collection, name: 'Zorr Beasts', uri: collUri }).sendAndConfirm(umi)
  coll = { address: collection.publicKey, uri: collUri, image: collImage }
  write('collection.json', coll)
  console.log('Collection:', coll.address)
}
const collection = await fetchCollection(umi, coll.address)

// ---- Assets ----
const beasts = read('genesis.json', null)
if (!beasts) throw new Error('run `npm run curate` first')
const manifest = read('manifest.json', [])
const done = new Set(manifest.map((m) => m.id))

for (const b of beasts) {
  if (done.has(b.id)) continue
  const el = ELEMENT_META[b.element]
  const image = await uploadSvg(beastSvg(b), `${b.seed}.svg`)
  const metadata = {
    name: b.name,
    symbol: 'ZORR',
    description: `A ${b.rarity} ${el.label} Guardian. Battle it in Zorr — its stats are sealed by the on-chain seed.`,
    image,
    attributes: [
      { trait_type: 'Element', value: el.label },
      { trait_type: 'Rarity', value: b.rarity },
      { trait_type: 'Power', value: b.power },
      { trait_type: 'HP', value: b.maxHealth },
      { trait_type: 'Attack', value: b.stats.attack },
      { trait_type: 'Defense', value: b.stats.defense },
      { trait_type: 'Speed', value: b.stats.speed },
      { trait_type: 'Magic', value: b.stats.magic },
      { trait_type: 'Seed', value: b.seed },
    ],
    properties: { files: [{ uri: image, type: 'image/svg+xml' }], category: 'image' },
  }
  const uri = await uploadJson(metadata, `${b.seed}.json`)
  const asset = generateSigner(umi)
  await create(umi, { asset, collection, name: b.name, uri }).sendAndConfirm(umi)
  const entry = { id: b.id, seed: b.seed, name: b.name, element: b.element, rarity: b.rarity, asset: asset.publicKey, uri, image }
  manifest.push(entry)
  write('manifest.json', manifest)
  console.log(`✅ [${manifest.length}/48] ${b.name} (${b.rarity}) → ${asset.publicKey}`)
}

console.log(`\n🎉 Genesis complete — ${manifest.length} Zorr Beasts minted into collection ${coll.address}`)
console.log(`Explorer: https://explorer.solana.com/address/${coll.address}?cluster=devnet`)
