---
format: 1920x1080
message: "Your city becomes a Solana game board you actually own"
arc: PAS — hook → pain → product intro → flow (ER → VRF → duel) → proof → CTA → outro
audience: MagicBlock hackathon judges, Solana builders, mobile gamers
mode: autonomous
music: minimal electronic, premium fintech, confident low pulse — mixed very low (5%)
---

## Video direction

- **Palette system** (from `frame.md`, never invented): ground `bg-primary` #05050B everywhere; panels `bg-secondary`/`white-overlay` behind phone frames; every rule/border is the 1px `line` hairline; headlines `text-primary` white in Audiowide 400; chrome/labels `text-secondary` Space Mono uppercase tracked; **accent #7C3AED is scarce** — the active/keyword word, one glow bloom per frame at most, the CTA press. Emerald appears ONLY inside the app screenshots themselves.
- **Motion grammar**: long-tail smooth settles (`power3` family) — no bounce, no overshoot, no elastic. VO-paced reveals: at t=0 only what the narrator is saying exists; every further line/card/phone reveals on its spoken cue, weighted into the back ~50% of each frame. Camera work limited to slow push-in on phone-frame heroes and the two seam cuts named per frame. During holds: stillness or subtle jitter only — no breathing, no back-half pans.
- **Rhythm / held frames**: Frame 2's final word ("nothing.") holds in silence-like stillness; Frame 7 ends on a full held triptych read; Frame 9 is the calm held closer. Frames 3–6 carry the kinetic energy.
- **Phone-frame treatment**: every app screenshot sits in a minimal device frame — 1px hairline border, 0 radius per cartesian (circles only exception: none), never stretched, always cropped/panned inside the mask. Screenshots are portrait 1080×2400 — show top-anchored crops; camera may push in slightly on the hero region.
- **Negative list**: no slideshow (front-load-then-freeze), no screensaver (independent floaters), no bouncy easing, no rounded SaaS cards, no shadows, no purple-blue "AI gradient" washes, no invented metrics, no browser chrome/cursors except the named CTA press. Bottom ~17% stays clear for the caption pill.
- **Audio mix note (for assembly/render)**: BGM at ~5% volume under the voice; SFX sparse — only the named transition whooshes and one CTA click — mixed at ~20%.

## Frame 1 — Hook

- scene: Bare near-black canvas; one giant Audiowide line lands, the key word swaps in place
- voiceover: "Your city — is the game board."
- duration: 1.941s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Future pacing
- beat: curiosity
- blueprint: kinetic-type-beats (Reproduce)
- asset_candidates:
- focal: typography
- roles: —

narrativeRole: Stop the scroll — reframe the viewer's own streets as a playable board.
keyMessage: The world you walk through every day is the game.

Scene 1 (0.0–1.6s): ground is bare #05050B with a single faint geo-ring lower-right (~30cqw, 20% opacity). As VO opens, "Your city" lands center-left in Audiowide h1 via per-word staggered reveal — two words only, Centered ~50% of frame, generous silence.
Scene 2 (1.6–3.2s): on the dash pause, a 1px hairline draws itself horizontally under the line (SVG self-draw). On "game board," the phrase completes with a hard-cut word-swap: "city" swaps in place to accent-violet "game board" (in-place token cycle) — the swap is the beat; keyword glow (accent) on the swapped token only.
Scene 3 (3.2–4.5s): held read, dead still; the geo-ring's dashed inner ring completes its self-draw quietly. Nothing else moves.

## Frame 2 — The problem

- scene: Three short pain lines land solo on bare canvas; the last word stings
- voiceover: "Territory games track your runs. But your world lives on their servers. You own — nothing."
- duration: 6.144s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-problem.html
- type: pain_point
- persuasion: Pain validation
- beat: frustration
- blueprint: kinetic-type-beats (Reproduce)
- asset_candidates:
- focal: typography
- roles: —

narrativeRole: Validate the ownership pain every web2 fitness-territory game shares.
keyMessage: Their servers own your world.

Scene 1 (0.0–1.8s): "Territory games track your runs." lands alone, Audiowide h3, upper-third left-anchored, hard-cut in — no product, no imagery. Asymmetric 60/40 with emptiness carrying the right.
Scene 2 (1.8–3.8s): first line dims to text-secondary and shifts up a step; "But your world lives on their servers." hard-cuts in beneath it (kinetic beat-slam, one beat) — a 1px hairline separates the two. Reveal exactly on the spoken cue.
Scene 3 (3.8–6.0s): both dim; on "You own —" the canvas clears to one centered line; "nothing." lands as the lone word in Audiowide h2 white, then a held still read. No accent anywhere in this frame — the coldness is the design.

## Frame 3 — Meet Zorr

- scene: The empire map rises in a phone frame — glowing organic territories over a real city; brand name lands beside it
- voiceover: "Meet Zorr. Run — and the ground you cover becomes yours. On Solana."
- duration: 4.416s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/03-meet-zorr.html
- type: product_intro
- persuasion: Show-don't-tell proof
- beat: intrigue → clarity
- blueprint: cursor-ui-demo (Adapt)
- asset_candidates: assets/map-empires.png — hero map, glowing rival empires over real Hyderabad with emerald player territory
- focal: assets/map-empires.png
- roles: map-empires = cutout (phone-framed hero)
- sfx: whoosh-short

narrativeRole: Name the product on top of its most cinematic real surface.
keyMessage: Zorr turns running into on-chain land ownership.

Adapt: keep cursor-ui-demo's signature "the surface itself is introduced by guided attention," but the guide is a slow camera push instead of a cursor — this is a phone game, no pointer chrome.
Scene 1 (0.0–2.0s): on "Meet Zorr," the wordmark ZORR lands center in Audiowide display via spring-pop entrance with smooth settle; a micro label "SOLANA × MAGICBLOCK" in Space Mono sits above it. Centered, ~55% empty.
Scene 2 (2.0–4.6s): on "Run —", the wordmark glides left to a 40% column (scale-swap handoff) while the phone-framed empire map rises from the lower edge into the right 60% (asymmetric 60/40, 3 depth layers: ground, faint geo-ring, phone). The map enters top-anchored showing the glowing empires.
Scene 3 (4.6–7.0s): on "becomes yours," a slow zoom-to-target pushes into the emerald player territory at the map's center; on "On Solana," a keyword glow (accent) lights the word "Solana" in the left column tagline "the ground you cover becomes yours." Held read on the pushed-in map.

## Frame 4 — Gasless captures (MagicBlock ER)

- scene: Home console in a phone frame at left; at right a typographic rail delegate → capture ⚡ ~100ms → commit, program id in micro type
- voiceover: "Every capture lands gasless on a MagicBlock Ephemeral Rollup — about a hundred milliseconds — then commits to Solana."
- duration: 8.235s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-er-captures.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: confidence
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/home-console.png — home with territory numeral, compass ring, Start a Run CTA; assets/map-empires.png — map alternative
- focal: assets/home-console.png
- roles: home-console = cutout (phone-framed hero) · map-empires = supporting (unused if crowding; may ghost at 20% behind rail)
- sfx: whoosh-short

narrativeRole: The first MagicBlock pillar — speed + gasless captures, stated plainly with the real pipeline.
keyMessage: Captures are instant, gasless, and settle to Solana.

Adapt: keep the device-hero signature (window held as hero while content advances); the "screens cycling" becomes the pipeline rail building beside the static console — the rail is the flow.
Scene 1 (0.0–2.2s): phone-framed home console slides up into the left 40% (motion-blur streak on arrival, then smooth settle); Space Mono label "MAGICBLOCK · EPHEMERAL ROLLUPS" reveals above the right column as the VO says "gasless."
Scene 2 (2.2–5.2s): the pipeline rail builds one station per spoken cue down the right 60% (per-word staggered reveal, one hairline between stations): "delegate" → on "Ephemeral Rollup" the station "capture ⚡" lands with the ~100ms chip counting up (value-scaled counter, small); accent glow blooms once behind the ⚡ station only.
Scene 3 (5.2–8.0s): on "commits to Solana," the final station "commit → Solana" reveals; beneath the rail the program id BSDY7ZusGE7372ydW7K8BuE8ZoiYumTBrAR9uymPGL1F types on in micro Space Mono (type-on with caret). Held read; subtle jitter only on the ⚡ chip.

## Frame 5 — Provably-fair Guardians (MagicBlock VRF)

- scene: Genesis claim screen in the phone frame; the claimed NFT card glows; VRF rail request → oracle callback ~700ms
- voiceover: "Claim a Guardian. MagicBlock VRF draws one of forty-eight real NFTs — provably fair, art on Arweave."
- duration: 8.384s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/05-vrf-guardians.html
- type: feature_showcase
- persuasion: Statistical proof
- beat: FOMO → trust
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/genesis-claim.png — GENESIS DROP panel 46/48 left + claimed Molten Panther NFT card
- focal: assets/genesis-claim.png
- roles: genesis-claim = cutout (phone-framed hero)
- sfx: whoosh-short

narrativeRole: The second MagicBlock pillar — verifiable randomness makes the drop trustless.
keyMessage: Your NFT is drawn fairly, on-chain, for real.

Adapt: mirror of Frame 4 (phone right this time — alternate the split so the run doesn't repeat); rail on the left carries the VRF flow.
Scene 1 (0.0–2.0s): phone-framed genesis-claim screen slides up into the right 40%; on "Claim a Guardian," a zoom-to-target pushes gently toward the Molten Panther NFT card region of the screenshot.
Scene 2 (2.0–5.4s): left 60% rail builds on cues: on "MagicBlock VRF" the label "MAGICBLOCK · VRF" reveals; on "forty-eight" a value-scaled counter counts 1→48 in Audiowide stat-figure with "GENESIS NFTS" label; on "provably fair" the rail station "request → oracle callback ~700ms" reveals over a hairline with keyword glow (accent) on "provably fair" only.
Scene 3 (5.4–8.0s): on "art on Arweave," a micro Space Mono line "METAPLEX CORE · ART ON ARWEAVE" reveals under the counter; ambient glow blooms faintly behind the phone's NFT card once. Held read.

## Frame 6 — Duel anywhere

- scene: Mid-battle arena in the phone frame — HP bars drain; three mode chips (AI · Bluetooth · Online) pop beside it
- voiceover: "Then battle it. Versus AI, over Bluetooth, or online — both phones compute the exact same fight."
- duration: 7.104s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/06-duel.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: excitement
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/arena-duel.png — live fight, glass fighter cards + element move tiles; assets/arena-lobby.png — lobby with mode buttons
- focal: assets/arena-duel.png
- roles: arena-duel = cutout (phone-framed hero) · arena-lobby = supporting (source of truth for mode chips; not shown as second phone)
- sfx: whoosh-short

narrativeRole: Close the play loop — the NFT is a fighter, and PvP is trustless by determinism.
keyMessage: Deterministic battles work anywhere, no server to trust.

Adapt: back to phone-left; the cycling-screens signature becomes the three mode chips landing as the VO names each mode.
Scene 1 (0.0–1.6s): phone-framed arena-duel slides up into left 40% on "Then battle it," camera holding on the two fighter cards.
Scene 2 (1.6–4.6s): right column: three hairline chips land one per spoken cue — "VS AI" on "AI," "BLUETOOTH" on "Bluetooth," "ONLINE · ROOM CODE" on "online" (cluster→outward is wrong here; these are sequential kinetic beat-slams, smooth settle, stacked vertical list). Space Mono, no accent yet.
Scene 3 (4.6–7.0s): on "the exact same fight," a single hairline connects the three chips to one micro line beneath: "one deterministic engine — only the move index crosses the wire," with keyword glow (accent) on "deterministic." Held read.

## Frame 7 — Real, everywhere

- scene: Three proof cards assemble — leaderboard (real players), wallet (Zorr Beasts × 1), profile ranks — each with a one-word caption
- voiceover: "Real NFTs. Real players. A live leaderboard where every row — is a real device."
- duration: 6.528s
- transition_in: blur-crossfade
- status: animated
- src: compositions/frames/07-proof.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof
- beat: trust
- blueprint: grid-card-assemble (Reproduce)
- asset_candidates: assets/leaderboard-real.png — LIVE REAL PLAYERS board; assets/wallet.png — wallet with Zorr Beasts asset row; assets/profile.png — rank identity card
- focal: assets/leaderboard-real.png
- roles: leaderboard-real = cutout (center, tallest) · wallet = cutout (left) · profile = cutout (right)

narrativeRole: Sweep the remaining surfaces as evidence — nothing in this app is mocked.
keyMessage: Everything on screen is live data.

Scene 1 (0.0–1.8s): on "Real NFTs," the wallet phone-frame rises left-of-center (staggered cascade begins) with a Space Mono caption "REAL NFTS" on a hairline beneath it. Triptych forming, 3 depth layers.
Scene 2 (1.8–3.6s): on "Real players," the profile frame rises right-of-center, caption "REAL RANKS"; the triptych balances.
Scene 3 (3.6–7.0s): on "live leaderboard," the leaderboard frame rises dead-center slightly taller (hierarchy by size + position), caption "REAL DEVICES"; on the final "real device," keyword glow (accent) sweeps that caption once. Full held triptych read to the end — deliberately still.

## Frame 8 — CTA

- scene: The tagline lands beat by beat, then the GitHub URL settles on a hairline rule
- voiceover: "Zorr. Walk. Capture. Own the map."
- duration: 2.219s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/08-cta.html
- type: cta
- persuasion: Rule of three
- beat: motivation
- blueprint: kinetic-type-beats (Reproduce)
- asset_candidates:
- focal: typography
- roles: —
- sfx: click-soft

narrativeRole: The three-verb brand mantra becomes the ask.
keyMessage: Walk. Capture. Own the map.

Scene 1 (0.0–1.2s): "ZORR" lands centered in Audiowide h1 (spring-pop, smooth settle) over a faint geo-ring.
Scene 2 (1.2–4.2s): the mantra lands as kinetic beat-slams, one word per spoken beat beneath the mark: "WALK." → "CAPTURE." → "OWN THE MAP." — the final phrase swaps its last token to accent violet (in-place token cycle) and holds. Centered column, ~55% empty.
Scene 3 (4.2–6.5s): a 1px hairline draws under the mantra; "github.com/nickthelegend/zorr" reveals on it in Space Mono; a small accent block presses once behind "zorr" (button press, single ui-click). Held.

## Frame 9 — Outro

- scene: ZORR wordmark holds center inside a faint compass ring; the repo URL types beneath
- voiceover: "Open source on GitHub — nickthelegend slash zorr."
- duration: 3.648s
- transition_in: crossfade
- status: animated
- src: compositions/frames/09-outro.html
- type: branding
- persuasion: Risk reversal
- beat: peace of mind
- blueprint: typewriter-reveal (Reproduce)
- asset_candidates:
- focal: typography
- roles: —

narrativeRole: Land the destination while the mark holds still — calm, assured close.
keyMessage: github.com/nickthelegend/zorr

Scene 1 (0.0–1.5s): ZORR holds dead-center in Audiowide h2 (already settled — it simply is, no entrance beyond a soft fade); the largest geo-ring (solid + dashed, ~40cqw) completes a slow SVG self-draw around it.
Scene 2 (1.5–4.5s): beneath the mark, "github.com/nickthelegend/zorr" types on with caret (backspace-free, steady) as the VO reads the address; caret blinks accent violet.
Scene 3 (4.5–6.0s): everything holds perfectly still; the caret blinks twice more and stops. End on stillness.
