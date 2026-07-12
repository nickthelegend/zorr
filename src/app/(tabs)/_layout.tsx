import { BlurView } from 'expo-blur'
import { router, Tabs } from 'expo-router'
import { Flag, Home, Swords, User, Wallet } from 'lucide-react-native'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '../../theme'

/**
 * Elevated center action button — opens the Arena (PvP). It finds nearby players
 * over Bluetooth (expo-nearby-connections), a room-code online match, or an AI
 * bot. Rendered as a raised FAB that pops above the tab bar (AlgoQuest-style).
 */
function PvpTabButton({ lift }: { lift: number }) {
  return (
    <View style={styles.fabSlot} pointerEvents="box-none">
      <Pressable
        onPress={() => router.navigate('/battle')}
        hitSlop={10}
        style={({ pressed }) => [styles.fab, { marginTop: lift }, pressed && styles.fabPressed]}
      >
        <Swords color="#FFFFFF" size={26} />
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  // Content row of icons is a fixed height; the system nav bar (insets.bottom)
  // becomes padding under it so the tab bar is never overlapped.
  const CONTENT = Platform.OS === 'ios' ? 56 : 60
  const bottomPad = Math.max(insets.bottom, 10)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: [styles.tabBar, { height: CONTENT + bottomPad, paddingBottom: bottomPad }],
        tabBarItemStyle: { height: CONTENT, paddingTop: 10 },
        tabBarBackground: () => <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />,
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="capture" options={{ tabBarIcon: ({ color, size }) => <Flag color={color} size={size} /> }} />
      {/* Center action FAB → the Arena (nearby / online / AI duels). Sits just
          slightly above the bar (not floating way up). */}
      <Tabs.Screen name="pvp" options={{ tabBarButton: () => <PvpTabButton lift={-14} /> }} />
      <Tabs.Screen name="wallet" options={{ tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
      {/* Leaderboard moved off the tab bar — reachable from the Home header. */}
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.85)',
    elevation: 0,
  },
  fabSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  fabPressed: { transform: [{ scale: 0.93 }], shadowOpacity: 0.35 },
})
