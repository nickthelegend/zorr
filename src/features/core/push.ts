import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Foreground notifications still pop as a banner + sound (Zorr is a game — the
// "blast" should land even while you're in the app).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

let granted = false

/** Create the Android channel + ask for permission. Call once at app start. */
export async function initNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('zorr', {
        name: 'Zorr',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 90, 180],
        lightColor: '#7C3AED',
      })
    }
    let status = (await Notifications.getPermissionsAsync()).status
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
    granted = status === 'granted'
  } catch {
    granted = false
  }
}

export function notificationsGranted() {
  return granted
}

/** Fire an immediate local OS notification (no-op until permission is granted). */
export async function blastNotification(title: string, body: string) {
  if (!granted) return
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    })
  } catch {
    /* notifications are best-effort */
  }
}
