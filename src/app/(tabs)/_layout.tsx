import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import { Flag, Home, Trophy, User, Wallet } from 'lucide-react-native'
import { Platform, StyleSheet } from 'react-native'

import { colors } from '../../theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="capture"
        options={{ tabBarIcon: ({ color, size }) => <Flag color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{ tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
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
})
