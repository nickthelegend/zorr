# Zorr — Roadmap & Status

**Solana Blitz v6 (MagicBlock) — Mobile.** A GPS territory game: run to capture
real-world land (km²), claim VRF-dropped Guardian NFTs, battle them over
Bluetooth or the internet, and settle everything on Solana via MagicBlock.

## ✅ Phase 1 — Base game (done, verified on-device)

- Expo 55 + RN 0.83 + @solana/kit; native Android dev client.
- "Neon cartography" design system + premium UI kit (glass hairline cards,
  spring press feedback, gradient CTAs, animated meters, compass LevelRing).
- Live Google Maps game board (LEGACY renderer for the styled map), real GPS,
  anti-cheat activity gating, INTVL-style run sessions with live km².
- Game layer: XP, cartography rank ladder, combos, 12 achievements, lifetime
  metrics (runs/km/duels), haptics — all persisted.

## ✅ Phase 2 — MagicBlock Ephemeral Rollups (done, proven live)

- Custom Anchor program `BSDY7Zus…` (ephemeral-rollups-sdk): delegate →
  gasless `capture_tile` ON the ER (~50–150 ms) → commit → undelegate.
- Proven live from tests and the app; in-app captures post to the ER with a
  devnet memo fallback.

## ✅ Phase 3 — PvP Guardian duels (done)

- Deterministic seed-driven battle engine (AlgoQuest math ported: 6-element
  chart, crits, burn/poison, energy) — both phones compute identical results;
  only the ability index crosses the wire. Two-device loopback test proves sync.
- Three transports: vs AI, Bluetooth (Google Nearby, runtime permissions), and
  online via room-code WebSocket relay (`npm run relay`, socket test green).

## ✅ Phase 4 — MagicBlock VRF (done, proven live)

- `request_seed`/`callback_seed` on the same program; oracle fulfills ~700 ms.
- Used twice: provably-fair summons and trustless host-authoritative battle
  seeds (deterministic fallback so play never blocks).

## ✅ Phase 5 — Real NFTs: the Genesis 48 (done, live on devnet)

- 48 Zorr Beasts minted as Metaplex Core NFTs into collection `76hkTNNZ…`,
  procedural neon trading-card art + metadata on Arweave (Irys). The NFT's
  `Seed` trait IS the battle identity (byte-identical JS/TS derivation).
- VRF claim relay drops a random unclaimed NFT to the player's wallet
  (`cd nft && npm run relay`); double-claim ledger; verified end-to-end
  on-device (claim → transfer → Arweave card renders → fights in the Arena).

## ✅ Phase 6 — Accounts & off-chain (done)

- **Privy**: the official PrivyElements modal ("Connect with Privy"), plus
  guest accounts (real Privy users, no OTP) — everyone gets an embedded
  Solana wallet; the full wallet lifecycle is surfaced (create / recover /
  error states, never swallowed). Dashboard must allow `com.zorr.app` and
  enable guest accounts.
- **MongoDB Atlas**: the relay hydrates + mirrors players, NFT claims and the
  live global leaderboard to the cluster (`zorr` db) with JSON fallback;
  credentials live in gitignored `nft/.env`.
- The global leaderboard is REAL players only — every device posts its live
  stats; rows deep-link to the owner's wallet on Explorer.

## ⬜ Honest next (post-hackathon)

- Session keys for popup-less signing with user-owned wallets.
- Push notifications (raid alerts when your territory is stolen).
- Route planner + weekly seasons/resets; SFX pass.
- iOS build (code is cross-platform; needs an Apple dev account).
