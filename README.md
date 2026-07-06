# Zorr — Walk & Capture the Land

**A real-time GPS territory game on Solana. Conquer your city on foot — and every run is a real on-chain transaction.**

Built for **Solana Blitz v6 (MagicBlock)**, Mobile theme.

Zorr is an INTVL-style running game: you **Start a Run**, and the ground you physically cover becomes your territory (measured in km²). Rival clans hold part of the map — run through their tiles to steal them. An AI/heuristic anti-cheat blocks GPS spoofing and vehicles, so only real movement counts. End a run and **log it on-chain to Solana** — your territory is backed by a verifiable transaction.

## The loop

1. **Start a Run** → your GPS path auto-captures tiles as you move.
2. **Steal rival ground** → running through a rival tile flips it to your color (2× XP).
3. **Live stats** → km² captured, distance, duration, pace — with a pulsing recorder.
4. **End Run → summary** → area + XP, rate how it felt.
5. **Log run on-chain** → a real, confirmed Solana devnet transaction.
6. **Climb the weekly leaderboard** by km² held.

## Why on-chain (the MagicBlock story)

Territory games like INTVL keep your progress on their servers. In Zorr, **every capture is a real Solana transaction** signed by a session/game wallet — no popups per action.

Per-tile claims run on a **MagicBlock Ephemeral Rollup**: a delegated `territory` PDA is captured **on the ER** (gasless, ~50–150 ms), then committed back to Solana devnet. This is **built and proven**, not a roadmap item — see below.

### MagicBlock Ephemeral Rollup — implemented ✅

- **Program:** [`BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F`](https://explorer.solana.com/address/BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F?cluster=devnet) — a custom Anchor program using `#[ephemeral]` / `#[delegate]` and the `ephemeral-rollups-sdk` (`initialize` / `delegate` / `capture_tile` / `commit` / `undelegate`).
- **ER endpoint:** `https://devnet-as.magicblock.app` · **validator** `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57`.
- **Flow:** `initialize` → `delegate` PDA to the ER → `capture_tile` **on the ER** (gasless) → `commit` state back to devnet base layer.
- **Proven:** the full delegate → gasless capture → commit path passes live on devnet via `onchain/tests/zorr-er.ts` (~154 ms capture), and standalone via `@solana/kit` (~51 ms). In the app, `src/features/chain/er.ts#captureTileOnER` builds the same instruction and posts it to the ER, with a devnet memo tx as fallback.

## Features

- Real device **GPS** + live **Google Maps** (dark, neon-glow territory)
- **Anti-cheat**: speed/activity gating (Idle/Walking/Running/Vehicle)
- **Run sessions** with distance/duration/pace + km² territory
- **Rival clans** — contested tiles you steal by running
- **Weekly leaderboard** (your rank is live from your captured km²)
- **XP, levels, combos, achievements, player identity** (name + color)
- **Real on-chain run logging** (Solana devnet, verified)
- Embedded wallet via **Privy** (email) or **guest** mode; funded game wallet for signing
- Rich UI throughout: animated aurora login, gradient-border cards, Audiowide + mono type

## Tech stack

- **Expo 55 / React Native 0.83** (expo-router)
- **@solana/kit** for transactions/signing, **react-native-maps** (Google), **expo-location**
- **Privy** embedded Solana wallet + guest mode
- **react-native-reanimated** for motion; dark "neon cartography" design system

## Run it

```bash
npm install
cp .env.example .env          # fill in Google Maps key + game wallet secret (see .env.example)
npm run android               # native dev build on an Android device/emulator
```

Notes:
- Needs an Android device/emulator (Mobile Wallet Adapter + native modules; no Expo Go / iOS sim).
- Fund the game wallet address (shown in the Wallet tab) with devnet SOL to make claims land.
- Guest mode works with no Privy setup; email login needs `com.zorr.app` allow-listed in the Privy dashboard.

## Tests

```bash
npm test               # 36 unit tests (jest-expo) — tiles, rivals, leaderboard,
                       # run helpers, level curve, on-chain encoding, and the
                       # PvP duel engine (protocol, host election, outcome,
                       # + a two-peer loopback that proves both phones agree)
npm run test:integration   # live devnet: program is deployed + executable,
                           # territory PDA exists, capture_tile encoding matches IDL
```

Deep write-path integration (delegate → gasless ER capture → commit) lives in `onchain/tests/zorr-er.ts`.

## Status (honest)

Done and verified: onboarding/login (**Privy** email OTP + embedded Solana wallet, or guest),
GPS + maps + anti-cheat, run sessions, rivals, leaderboard, wallet/profile/settings,
**real on-chain run logging** (confirmed devnet tx), and the **MagicBlock Ephemeral Rollup** program
(deployed, delegated, gasless capture + commit — proven live).

The **PvP tap-duel** is complete: single-player vs a deterministic bot, plus a Bluetooth/Wi-Fi
peer duel over Google Nearby Connections — synchronized start (nonce host election + shared GO
signal), live score sync, disconnect-forfeit, and rematch. Its fairness logic (protocol, election,
winner reconciliation) is proven by a two-peer loopback test, so both devices always agree on the
winner; runtime Bluetooth/location permissions are declared and requested. The one thing software
can't self-check is the radio pairing between two physical phones — that's a device QA step, not a
code gap. `tsc` 0 errors · eslint 0 warnings · 36/36 unit tests · integration green · full Metro bundle.
