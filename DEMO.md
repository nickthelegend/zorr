# Zorr — 2-minute demo script (Solana Blitz v6 · MagicBlock · Mobile)

> **⚠️ DEPRECATED** — superseded by the 60-second product launch video in
> [`videos/zorr-launch/`](videos/zorr-launch/) (see `docs/zorr-launch.mp4`).
> Kept for reference as the long-form walkthrough script.

> Pre-flight: `cd nft && npm run relay` (VRF drop + Mongo leaderboard),
> `npm run relay` in the app root (online duels), Metro running, phone/emulator
> with the dev client. Fund check: game wallet has devnet SOL.

**0:00 — Hook.** Open on the Home console: compass level ring, rank pill,
territory km². *"Zorr turns your city into a Solana game board — walk to
capture land, and everything settles through MagicBlock."*

**0:15 — Run & capture (MagicBlock ER).** Tap **Start a Run** on the map
(neon-black board, emerald territory glow). Walk a few steps (or emulator geo
fixes) — tiles capture with a buzz, live km² ticks up. End run → summary →
**Claim on MagicBlock ER ⚡** → toast shows the gasless ER capture in ~100 ms.
*"Every capture is a real transaction on an Ephemeral Rollup — instant and
gasless — then committed back to Solana."*

**0:45 — Claim a Guardian (VRF + real NFTs).** Guardians screen → **Claim from
Genesis Drop**. *"48 Zorr Beasts are live Metaplex Core NFTs with Arweave art.
MagicBlock VRF draws which one you get — provably fair."* The claimed card
renders from Arweave; tap the explorer link to show real on-chain ownership.

**1:15 — Duel (deterministic PvP).** Arena → **Quick Duel** (or a room-code
online duel against a second device). Type-advantage moves, animated HP bars.
*"Battles are a deterministic engine seeded by VRF — two phones compute
identical fights, so there's no server to trust and no way to cheat."* Win →
+300 XP, haptic hit.

**1:45 — Proof it's a world.** Leaderboard: *"Real players only — every row is
a live device, persisted to MongoDB, deep-linked to its wallet."* Wallet tab:
Privy embedded wallet (official Privy modal for sign-in) + game wallet + the
Zorr Beasts NFT count.

**1:55 — Close.** *"One deployed program, two MagicBlock products — Ephemeral
Rollups and VRF — real NFTs, and a game you play with your legs. Zorr."*

## Judge quick-verify (no phone needed)
- `npm test` — 62 unit tests (engine loopback = two-phone sync proof)
- `npm run test:integration` — live devnet: program + territory PDA
- `cd onchain && npm run test:vrf` — live VRF oracle round-trip (~700 ms)
- `npm run test:socket` — online duel relay
- Explorer: program `BSDY7Zus…`, collection `76hkTNNZ…` (see README links)
