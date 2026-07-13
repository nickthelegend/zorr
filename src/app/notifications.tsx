import { router } from 'expo-router'
import { Bell, Coins, MapPin, Shield, Sparkles, Swords, Trash2, X } from 'lucide-react-native'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { clearNotes, markAllRead, type NoteKind, useNotifications } from '../features/core/notifications-store'
import { colors, fonts, radius } from '../theme'

const META: Record<NoteKind, { icon: typeof Bell; color: string }> = {
  capture: { icon: MapPin, color: colors.territory },
  guardian: { icon: Sparkles, color: colors.primary },
  wager: { icon: Swords, color: colors.gold },
  swap: { icon: Coins, color: colors.gold },
  system: { icon: Shield, color: colors.textMuted },
}

function rel(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationsScreen() {
  const { notes } = useNotifications()

  // Opening the panel clears the unread badge.
  useEffect(() => {
    const t = setTimeout(markAllRead, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <View style={styles.titleIcon}>
              <Bell color={colors.primary} size={18} />
            </View>
            <Text style={styles.title}>Notifications</Text>
          </View>
          <View style={styles.headerBtns}>
            {notes.length > 0 ? (
              <TouchableOpacity style={styles.iconBtn} onPress={clearNotes} hitSlop={8}>
                <Trash2 color={colors.textMuted} size={18} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
              <X color={colors.text} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {notes.length === 0 ? (
          <View style={styles.empty}>
            <Bell color={colors.textFaint} size={34} />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySub}>Captures, Guardian drops, wager wins and swaps will show up here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {notes.map((n, i) => {
              const m = META[n.kind] ?? META.system
              const Icon = m.icon
              return (
                <Animated.View key={n.id} entering={FadeInDown.delay(Math.min(i, 8) * 40)} style={styles.row}>
                  <View style={[styles.rowIcon, { borderColor: m.color, backgroundColor: `${m.color}18` }]}>
                    <Icon color={m.color} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{n.title}</Text>
                    <Text style={styles.rowBody}>{n.body}</Text>
                  </View>
                  <Text style={styles.rowTime}>{rel(n.ts)}</Text>
                </Animated.View>
              )
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 21 },
  headerBtns: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  emptySub: { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  list: { padding: 16, gap: 10, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  rowBody: { color: colors.textDim, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  rowTime: { color: colors.textFaint, fontSize: 11, fontFamily: fonts.data },
})
