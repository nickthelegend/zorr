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

Territory games like INTVL keep your progress on their servers. In Zorr, **every run is a real, verifiable Solana transaction** signed by an embedded/game wallet — no popups per action. Roadmap: move per-tile claims onto a **MagicBlock Ephemeral Rollup** (delegated PDA) for gasless, instant, real-time claims during a run.

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

## Status (honest)

Done and verified on-device: onboarding/login, GPS + maps + anti-cheat, run sessions, rivals,
leaderboard, wallet/profile/settings, and **real on-chain run logging** (a confirmed devnet tx).
Next architectural step: the delegated **MagicBlock Ephemeral Rollup** program for gasless/instant
per-tile claims (Stage 2), plus optional PvP/Bluetooth battles.
