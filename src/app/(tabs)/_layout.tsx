import { BlurView } from 'expo-blur'
import { router, Tabs } from 'expo-router'
import { Flag, Home, Swords, User, Wallet } from 'lucide-react-native'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import { colors } from '../../theme'

/**
 * Elevated center action button — opens the Arena (PvP). It finds nearby players
 * over Bluetooth (expo-nearby-connections), a room-code online match, or an AI
 * bot. Rendered as a raised FAB that pops above the tab bar (AlgoQuest-style).
 */
function PvpTabButton() {
  return (
    <View style={styles.fabSlot} pointerEvents="box-none">
      <Pressable
        onPress={() => router.navigate('/battle')}
        hitSlop={10}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Swords color="#FFFFFF" size={26} />
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />,
      }}
    >
      <Tabs.Screen name="home" options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="capture" options={{ tabBarIcon: ({ color, size }) => <Flag color={color} size={size} /> }} />
      {/* Center action FAB → the Arena (nearby / online / AI duels). */}
      <Tabs.Screen name="pvp" options={{ tabBarButton: () => <PvpTabButton /> }} />
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
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: 8,
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
    marginTop: -22, // lift it above the bar so it "pops"
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
