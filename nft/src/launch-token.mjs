// Launch $ZORR — a real SPL token on Solana devnet. Creates the mint (9
// decimals, treasury = mint authority), mints the initial supply to the
// treasury, and writes out/token.json. Idempotent: if out/token.json already
// has a live mint, it just reports it. The treasury keypair is the same
// ~/.config/solana/zorr.json used to mint the Genesis NFTs.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from '@solana/spl-token'

const here = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(here, '..', 'out', 'token.json')

const DECIMALS = 9
const SUPPLY = 1_000_000_000 // 1 billion ZORR

const RPC = 'https://api.devnet.solana.com'
const connection = new Connection(RPC, 'confirmed')
const secret = JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/zorr.json`, 'utf8'))
const treasury = Keypair.fromSecretKey(Uint8Array.from(secret))

console.log('Treasury:', treasury.publicKey.toBase58())

// Resume: if a mint already exists on-chain, don't recreate it.
if (fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  try {
    const info = await getMint(connection, new PublicKey(existing.mint))
    console.log(`$ZORR already launched: ${existing.mint} (supply ${Number(info.supply) / 10 ** info.decimals})`)
    console.log(`Explorer: https://explorer.solana.com/address/${existing.mint}?cluster=devnet`)
    process.exit(0)
  } catch {
    console.log('token.json present but mint not found on-chain — relaunching.')
  }
}

const bal = await connection.getBalance(treasury.publicKey)
console.log('Treasury SOL:', (bal / LAMPORTS_PER_SOL).toFixed(4))
if (bal < 0.05 * LAMPORTS_PER_SOL) {
  console.log('Low balance — requesting devnet airdrop…')
  try {
    const sig = await connection.requestAirdrop(treasury.publicKey, LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig, 'confirmed')
  } catch (e) {
    console.log('Airdrop failed (devnet limit) — continuing:', e.message)
  }
}

console.log('Creating $ZORR mint…')
const mint = await createMint(connection, treasury, treasury.publicKey, treasury.publicKey, DECIMALS)
console.log('Mint:', mint.toBase58())

console.log('Creating treasury token account…')
const treasuryAta = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, treasury.publicKey)

console.log(`Minting ${SUPPLY.toLocaleString()} ZORR to treasury…`)
await mintTo(connection, treasury, mint, treasuryAta.address, treasury, BigInt(SUPPLY) * BigInt(10 ** DECIMALS))

const token = {
  name: 'Zorr',
  symbol: 'ZORR',
  mint: mint.toBase58(),
  decimals: DECIMALS,
  supply: SUPPLY,
  treasury: treasury.publicKey.toBase58(),
  treasuryAta: treasuryAta.address.toBase58(),
  rpc: RPC,
  cluster: 'devnet',
  launchedAt: new Date().toISOString(),
}
fs.writeFileSync(outPath, JSON.stringify(token, null, 2))

console.log('\n$ZORR launched ✅')
console.log('Mint:    ', token.mint)
console.log('Supply:  ', SUPPLY.toLocaleString(), 'ZORR')
console.log('Treasury:', token.treasuryAta)
console.log('Explorer:', `https://explorer.solana.com/address/${token.mint}?cluster=devnet`)
console.log('\nAdd to zorr/.env:  EXPO_PUBLIC_ZORR_MINT=' + token.mint)
