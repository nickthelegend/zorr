# Zorr — Roadmap & Status

**Solana Blitz v6 (MagicBlock) — Mobile.** A GPS territory game: run to capture
real-world land (km²), steal rival tiles, and log every run on-chain to Solana.

## ✅ Done (verified on-device)

- **Base**: Expo 55 + RN 0.83 + @solana/kit + Privy; native Android build.
- **UI**: dark "neon cartography" system — aurora login, gradient-border cards,
  Audiowide display + mono instrument type. Onboarding → login → 5 tabs.
- **Auth**: Privy email embedded wallet **and** guest mode (app fully usable
  without any dashboard setup). Player identity (name + color).
- **Maps + GPS**: live Google Maps (react-native-maps), real device GPS
  (expo-location), glowing territory + neon route trail.
- **Anti-cheat**: speed/activity gating — vehicles can't capture.
- **Run sessions (INTVL-style)**: Start Run → auto-capture ground → live
  km²/distance/duration/pace → summary (area + XP + rating) → Log run.
- **Rivals**: ~1/3 of the map held by clans; steal tiles by running (2× XP).
- **Leaderboard**: weekly km² ranking; your row is live.
- **Game**: XP, levels, combos, achievements, persisted progress.
- **Wallet / Profile / How-to-Play** screens.
- **On-chain**: every run logs a **real, confirmed Solana devnet transaction**
  signed by the Zorr game wallet (kit local signer; HTTP send to work under
  Hermes). Verified: run logged → tx confirmed on devnet.
- **Identity**: branded app icon/splash, README, .env template.

## ⬜ Next (honest)

- **Stage 2 — MagicBlock Ephemeral Rollup**: delegate a per-player territory PDA
  and claim each tile on the ER (gasless, instant, session-key signed) instead
  of one run-summary tx. Needs an Anchor program on the ER; the reference SDK
  targets Anchor 1.x while the local toolchain is 0.32.1 — the one item that
  needs a toolchain/version pass. Stage 1 on-chain already works and is real.
- **PvP + Bluetooth battles** (expo-nearby-connections) — the feature to port
  from AlgoQuest.
- Route planner, push notifications, haptics/SFX.

Reference: `../references_/magicblock-engine-examples` (anchor-counter,
session-keys, roll-dice=VRF, private-counter=PERs). ER devnet endpoints:
base `api.devnet.solana.com`, ER `devnet.magicblock.app`.
