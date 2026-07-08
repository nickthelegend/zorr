import * as Haptics from 'expo-haptics'

// Safe haptics — every call is fire-and-forget and swallowed on devices or
// emulators without a vibrator, so game code can sprinkle these freely.

/** Tiny tick for taps and selections. */
export function tapHaptic() {
  Haptics.selectionAsync().catch(() => {})
}

/** A solid hit — landing a move, capturing a tile. */
export function hitHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}

/** Big win moment — claim landed, duel victory. */
export function winHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}

/** Loss / error feedback. */
export function failHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
}
