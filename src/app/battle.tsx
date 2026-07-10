import { router } from 'expo-router'
import { Bluetooth, Bot, Globe, Repeat, Swords, X } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Aurora } from '../components/aurora'
import { BeastCard } from '../components/beast-card'
import { CTA, GhostBtn } from '../components/ui'
import { useGame } from '../features/game/game-store'
import { colors, fonts, radius } from '../theme'

function randomRoom(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]
  return s
}

export default function BattleLobby() {
  const game = useGame()
  const [room, setRoom] = useState('')

  const goOnline = () => {
    const code = (room.trim() || randomRoom()).toUpperCase().slice(0, 6)
    router.push(`/battle-arena?mode=online&room=${encodeURIComponent(code)}`)
  }

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.brand}>Arena</Text>
          <TouchableOpacity style={styles.close} onPress={() => router.back()}>
            <X color={colors.text} size={20} />
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeInUp} style={styles.hero}>
          <View style={styles.crest}>
            <Swords color={colors.primary} size={34} />
          </View>
          <Text style={styles.title}>Guardian Duel</Text>
          <Text style={styles.sub}>Turn-based monster battle. Type advantage and moves decide it — winner takes the XP.</Text>
        </Animated.View>

        {/* Your fighter */}
        <Animated.View entering={FadeInDown.delay(60)}>
          <View style={styles.fighterHead}>
            <Text style={styles.label}>Your Guardian</Text>
            <TouchableOpacity onPress={() => router.push('/guardians')}>
              <Text style={styles.change}>Change ›</Text>
            </TouchableOpacity>
          </View>
          {/* Preview at your real level so the card matches the stats you fight with. */}
          <BeastCard seed={game.activeBeast} level={game.level} />
        </Animated.View>

        {/* Modes */}
        <Animated.View entering={FadeInDown.delay(120)} style={styles.modes}>
          <CTA
            label="Quick Duel · vs AI"
            icon={<Bot color="#04110C" size={20} />}
            onPress={() => router.push('/battle-arena?mode=bot')}
          />

          <GhostBtn
            label="Bluetooth · nearby player"
            icon={<Bluetooth color={colors.text} size={20} />}
            onPress={() => router.push('/battle-arena?mode=bt')}
          />

          <View style={styles.onlineRow}>
            <TextInput
              style={styles.roomInput}
              placeholder="Room code"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={room}
              onChangeText={setRoom}
            />
            <GhostBtn label={room.trim() ? 'Join' : 'Create'} icon={<Globe color={colors.text} size={18} />} onPress={goOnline} />
          </View>
          <View style={styles.hintRow}>
            <Repeat color={colors.textFaint} size={12} />
            <Text style={styles.hint}>Online duels play over a room code — share it with a friend to battle anywhere.</Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  crest: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: colors.text, fontSize: 24, fontFamily: fonts.display },
  sub: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19, paddingHorizontal: 10 },
  fighterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: colors.textFaint, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  change: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  modes: { marginTop: 20, gap: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: radius.lg },
  primaryText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
  altBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  altText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  onlineRow: { flexDirection: 'row', gap: 10 },
  roomInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16, color: colors.text, fontSize: 16, fontFamily: fonts.mono, letterSpacing: 4 },
  onlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 15, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: 2 },
  hint: { color: colors.textFaint, fontSize: 11, flex: 1, lineHeight: 15 },
})
