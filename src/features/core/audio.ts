import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio'

// One-shot sound effects — small AAC clips, players created lazily and reused.
const SFX = {
  win: require('../../../assets/audio/sfx-win.m4a'),
  lose: require('../../../assets/audio/sfx-lose.m4a'),
  coin: require('../../../assets/audio/sfx-coin.m4a'),
  capture: require('../../../assets/audio/sfx-capture.m4a'),
  hit: require('../../../assets/audio/sfx-hit.m4a'),
  click: require('../../../assets/audio/sfx-click.m4a'),
  shield: require('../../../assets/audio/sfx-shield.m4a'),
}
export type SfxName = keyof typeof SFX

const players: Partial<Record<SfxName, AudioPlayer>> = {}
let bgm: AudioPlayer | null = null
let muted = false
let audioModeSet = false

async function ensureAudioMode() {
  if (audioModeSet) return
  audioModeSet = true
  try {
    await setAudioModeAsync({ playsInSilentMode: true })
  } catch {
    /* best-effort */
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (m) {
    try {
      bgm?.pause()
    } catch {
      /* ignore */
    }
  }
}
export function isMuted() {
  return muted
}

/** Fire a short SFX (no-op if muted). Safe to call anywhere. */
export function playSfx(name: SfxName) {
  if (muted) return
  ensureAudioMode()
  try {
    let p = players[name]
    if (!p) {
      p = createAudioPlayer(SFX[name])
      p.volume = 0.85
      players[name] = p
    }
    p.seekTo(0)
    p.play()
  } catch {
    /* audio is a nice-to-have — never crash on it */
  }
}

/** Start (or resume) the looping battle theme. */
export async function startBattleBgm() {
  if (muted) return
  await ensureAudioMode()
  try {
    if (!bgm) {
      bgm = createAudioPlayer(require('../../../assets/audio/battle-bgm.m4a'))
      bgm.loop = true
      bgm.volume = 0.45
    }
    bgm.seekTo(0)
    bgm.play()
  } catch {
    /* ignore */
  }
}

export function stopBattleBgm() {
  try {
    bgm?.pause()
  } catch {
    /* ignore */
  }
}
