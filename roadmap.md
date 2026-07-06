# Zorr — Roadmap

**Solana Blitz v6 (MagicBlock) — Mobile theme.**
A real-time, GPS-based on-chain quest & territory game. Physically visit locations to claim
quests/tiles; every claim is an instant, gasless transaction on a **MagicBlock Ephemeral Rollup**,
settled periodically to Solana. AI/heuristic anti-cheat blocks GPS spoofing and vehicle use.

Ported from two prior projects (see `../references_/`):
- **AlgoQuest** (my own, React Native/Expo, Algorand) — the rich UI + quest/geofence/claim loop + battles.
- **GPS-Runner** (Flutter, EVM) — the heavy anti-cheat brain + territory/coverage concept.

---

## Stack (base scaffold)

| Layer | Choice |
|-------|--------|
| App | Expo 55 + React Native 0.83 + expo-router (file-based) |
| Wallet | **Privy embedded** (email/social login → in-app Solana wallet) |
| Solana SDK | `@solana/kit` + `@wallet-ui/react-native-kit` |
| Styling | Uniwind (Tailwind for RN) + HeroUI Native |
| Real-time chain | **MagicBlock Ephemeral Rollups** (delegate PDAs → ER RPC) |
| Program | Anchor (Rust) — quest/tile PDAs, anti-cheat checks in-instruction |
| No-popup UX | **Session keys** (authorize once, sign claims locally) |
| Plugins | VRF (random spawns), Private ERs (hidden positions), Automation (cron settle) |

---

## Phase 1 — Solana + MagicBlock base ✅ (in progress)

Goal: a running Expo app that connects a wallet and can talk to a MagicBlock Ephemeral Rollup.

- [x] Install `solana-dev` skill.
- [x] Clone `magicblock-engine-examples` into `../references_/` (reference: `session-keys`,
      `anchor-counter`, `roll-dice`/`rewards-delegated-vrf` (VRF), `private-counter` (PERs)).
- [x] Scaffold Expo app (Privy embedded wallet template) → `zorr/`.
- [ ] `npm install` + first `npm run android` on device/emulator.
- [ ] Set up Privy app (App ID + Client ID in `.env`).
- [ ] Prove wallet connect + balance + sign transaction (template's built-in flows).
- [ ] Stand up the MagicBlock **counter** example as a smoke test: delegate a PDA, send a
      tx to the ER endpoint, commit back to Solana. Wire a throwaway screen that increments
      an on-chain counter through the ER to prove the real-time path end-to-end.

Reference docs:
- Overview: https://docs.magicblock.gg/pages/overview/products
- ER quickstart: https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart
- PERs quickstart: https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/how-to-guide/quickstart
- Counter template: https://docs.magicblock.gg/pages/templates/counter
- VRF quickstart: https://docs.magicblock.gg/pages/verifiable-randomness-functions-vrfs/how-to-guide/quickstart
- Examples repo: https://github.com/magicblock-labs/magicblock-engine-examples

---

## Phase 2 — Rich UI (exact AlgoQuest look) 🎨

Goal: match AlgoQuest's UI/UX pixel-for-pixel on the new Solana base.

- [ ] Bring over the design language: dark theme, gradients, typography, iconography.
- [ ] Screens to port (from `../references_/AlgoQuest/app/`): onboarding, tabs, `qmap` (map +
      geofence + claim), profile, wallet/send, NFTs/beast, friends, notifications, shop, DAO, events.
- [ ] Rebuild AlgoQuest's map/quest screen (`qmap.tsx`) on Solana: 50m geofence, live location
      stream, on-chain claim → **ER transaction** instead of Algorand app call.
- [ ] Map component: react-native-maps equivalent + custom markers.
- [ ] Keep it committed in real, incremental steps.

Note: AlgoQuest used StyleSheet + expo-linear-gradient + lucide icons; this base uses
Uniwind/Tailwind. Port screen-by-screen, translating styles to Uniwind.

---

## Phase 3 — Battles (KEEP — my $1.5k feature) ⚔️

Goal: real-time PvP beast battles, local (Bluetooth) + online, on the Solana base.

- [ ] Port PvP matchmaking + battle arena/lobby UI from AlgoQuest.
- [ ] Re-integrate **`expo-nearby-connections`** for IRL Bluetooth battles.
- [ ] Stretch: back real-time battle state with a **MagicBlock ER** (move/turn = ER tx,
      settle result to Solana) — strong sponsor story, pairs battles with the ER thesis.

---

## Core game loop (spans phases)

1. Physically enter a quest/tile radius → GPS + activity check passes anti-cheat.
2. Claim → session-key signs an instruction on the **ER** (10ms, gasless).
3. Territory/coverage updates live for all nearby players on the ER.
4. Periodic **commit/undelegate** settles state to Solana L1 for the permanent leaderboard.
5. VRF for random crypto/coin spawns; Private ERs to hide positions until claim.

## Anti-cheat (ported from GPS-Runner)

Speed cap (~8 m/s) · activity must be on-foot · pedometer min steps/min · GPS accuracy gate ·
teleport (Haversine) · mock-location detection. Checks enforced both client-side and
in the Anchor instruction (`require!`).
