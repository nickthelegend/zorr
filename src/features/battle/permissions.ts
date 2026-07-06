import { PermissionsAndroid, Platform } from 'react-native'

// Google Nearby Connections needs Bluetooth + location (and Wi-Fi-aware on
// newer Android). The runtime set differs by API level: BLUETOOTH_SCAN /
// _ADVERTISE / _CONNECT and NEARBY_WIFI_DEVICES are Android 12+ (API 31/33),
// while older devices only gate on fine location. We request whatever the
// running device actually declares and treat "all granted" as ready.
export async function requestNearbyPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const P = PermissionsAndroid.PERMISSIONS
    const wanted = [
      P.ACCESS_FINE_LOCATION,
      P.BLUETOOTH_SCAN,
      P.BLUETOOTH_ADVERTISE,
      P.BLUETOOTH_CONNECT,
      P.NEARBY_WIFI_DEVICES,
    ].filter(Boolean)

    const res = await PermissionsAndroid.requestMultiple(wanted)
    // Some keys may be undefined on older OSes; only the ones the device knows
    // about appear in the result, and those must all be granted.
    return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED)
  } catch {
    return false
  }
}
