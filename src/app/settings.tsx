import { router } from 'expo-router'
import { Ban, Flag, Footprints, Link2, Swords, X } from 'lucide-react-native'
import { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useGame } from '../features/game/game-store'
import { colors, fonts, radius } from '../theme'

function Rule({ icon, title, body, delay }: { icon: ReactNode; title: string; body: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.rule}>
      <View style={styles.ruleIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleBody}>{body}</Text>
      </View>
    </Animated.View>
  )
}

export default function SettingsScreen() {
  const game = useGame()
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>How to Play</Text>
        <TouchableOpacity style={styles.close} onPress={() => router.back()}>
          <X color={colors.text} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>Conquer your city, one tile at a time — and every run is real on-chain.</Text>

        <Rule
          icon={<Flag color={colors.territory} size={20} />}
          title="Start a run"
          body="Tap Start Run and move through the real world. The ground you cover becomes your territory, measured in km²."
          delay={40}
        />
        <Rule
          icon={<Swords color={colors.enemy} size={20} />}
          title="Steal rival ground"
          body="Rival clans hold part of the map. Run through their tiles to flip them to your color — worth double XP."
          delay={100}
        />
        <Rule
          icon={<Ban color={colors.gold} size={20} />}
          title="On foot only"
          body="Anti-cheat reads your speed and activity. Move above running pace and you're flagged as a vehicle — no captures."
          delay={160}
        />
        <Rule
          icon={<Link2 color={colors.primary} size={20} />}
          title="Log it on-chain"
          body="End a run and log it to Solana. Your territory and XP are backed by a real, verifiable transaction — powered by MagicBlock."
          delay={220}
        />
        <Rule
          icon={<Footprints color={colors.territory} size={20} />}
          title="Climb the board"
          body="Every km² pushes you up the weekly leaderboard. Hold your ground and outrun everyone."
          delay={280}
        />

        <Animated.View entering={FadeInDown.delay(340)}>
          <TouchableOpacity style={styles.reset} activeOpacity={0.8} onPress={() => game.reset()}>
            <Text style={styles.resetText}>Reset progress</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.version}>Zorr · Solana Blitz · devnet</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  lede: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  rule: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  ruleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  ruleBody: { color: colors.textDim, fontSize: 13.5, lineHeight: 20 },
  reset: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
    alignItems: 'center',
  },
  resetText: { color: colors.enemy, fontSize: 14, fontWeight: '600' },
  version: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 20, fontFamily: fonts.mono },
})
