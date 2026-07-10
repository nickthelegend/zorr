import { Redirect } from 'expo-router'

// The center tab is an action button (see _layout's tabBarButton) that opens the
// Arena. If this route is ever focused directly (e.g. a deep link), send it there.
export default function Pvp() {
  return <Redirect href="/battle" />
}
