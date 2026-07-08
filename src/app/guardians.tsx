import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Check, Link2, Sparkles, Swords, WifiOff } from 'lucide-react-native'
import { ActivityIndicator, Dimensions, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgUri } from 'react-native-svg'

import { RARITY_COLOR } from '../features/beasts/beast'
import { useGame } from '../features/game/game-store'
import { assetExplorerUrl } from '../features/nft/nft'
import { useGuardians } from '../features/nft/use-guardians'
import { colors, fonts, radius } from '../theme'

const COLS = 2
const GAP = 12
const CARD_W = (Dimensions.get('window').width - 40 - GAP) / COLS
const CARD_H = CARD_W * (720 / 512)

function short(a?: string | null) {
  return a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '…'
}

export default function GuardiansScreen() {
  const game = useGame()
  const g = useGuardians()
  const owned = g.owned ?? []

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={20} />
        </TouchableOpacity>
        <Text style={styles.brand}>Guardians</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>
          Your Guardians are real NFTs on Solana, dropped from the Genesis 48 by MagicBlock VRF. Send one into a duel over
          Bluetooth or online.
        </Text>

        {/* Drop card */}
        <Animated.View entering={FadeInDown.delay(40)}>
          <LinearGradient colors={['rgba(124,58,237,0.14)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dropCard}>
            <View style={styles.dropTop}>
              <Text style={styles.dropTitle}>GENESIS DROP</Text>
              {g.online ? (
                <Text style={styles.poolText}>{g.pool ? `${g.pool.remaining}/${g.pool.total} left` : '…'}</Text>
              ) : (
                <View style={styles.offlineRow}>
                  <WifiOff color={colors.gold} size={13} />
                  <Text style={styles.offlineText}>relay offline</Text>
                </View>
              )}
            </View>
            <Text style={styles.ownerLine}>Your wallet · {short(g.owner)}</Text>

            <TouchableOpacity activeOpacity={0.9} onPress={g.claim} disabled={g.claiming || !g.online || (g.pool?.remaining === 0)}>
              <LinearGradient
                colors={g.online ? ['#7C3AED', '#4C1D95'] : ['#333', '#222']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.claimBtn, (g.claiming || !g.online) && { opacity: 0.7 }]}
              >
                {g.claiming ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Sparkles color={colors.text} size={20} />
                    <Text style={styles.claimText}>{g.pool?.remaining === 0 ? 'Pool claimed out' : 'Claim from Genesis Drop'}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.claimHint}>
              {g.claiming ? 'MagicBlock VRF is drawing your Guardian…' : 'A random unclaimed NFT, picked by verifiable VRF.'}
            </Text>
            {g.error ? <Text style={styles.err}>{g.error}</Text> : null}
            {!g.online ? (
              <Text style={styles.err}>Start the claim relay (npm run relay in /nft) and set EXPO_PUBLIC_CLAIM_RELAY_URL.</Text>
            ) : null}
          </LinearGradient>
        </Animated.View>

        {/* Owned roster */}
        <Text style={styles.section}>
          Your Guardians{owned.length ? ` · ${owned.length}` : ''}
        </Text>

        {g.loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : owned.length === 0 ? (
          <Text style={styles.empty}>No Guardians yet — claim your first from the Genesis drop above.</Text>
        ) : (
          <View style={styles.grid}>
            {owned.map((b, i) => {
              const active = b.seed === game.activeBeast
              return (
                <Animated.View key={b.asset} entering={FadeIn.delay(60 + i * 40)} style={styles.cardWrap}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => game.setActiveBeast(b.seed)}>
                    <View style={[styles.card, { borderColor: active ? RARITY_COLOR[b.rarity as keyof typeof RARITY_COLOR] ?? colors.primary : colors.border }]}>
                      <SvgUri uri={b.image} width={CARD_W - 4} height={CARD_H - 4} />
                    </View>
                    {active ? (
                      <View style={styles.activePill}>
                        <Check color="#04110C" size={11} />
                        <Text style={styles.activeText}>Active</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.explorer} onPress={() => Linking.openURL(assetExplorerUrl(b.asset))}>
                    <Link2 color={colors.textDim} size={12} />
                    <Text style={styles.explorerText}>{short(b.asset)}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            })}
          </View>
        )}

        <TouchableOpacity style={styles.duelBtn} activeOpacity={0.9} onPress={() => router.push('/battle')}>
          <Swords color="#04110C" size={20} />
          <Text style={styles.duelText}>To the Arena</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  sub: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  dropCard: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.xl, padding: 18 },
  dropTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  poolText: { color: colors.territory, fontFamily: fonts.mono, fontSize: 13 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offlineText: { color: colors.gold, fontSize: 12 },
  ownerLine: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.mono, marginTop: 6 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: radius.lg, marginTop: 14 },
  claimText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  claimHint: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 8 },
  err: { color: colors.enemy, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  section: { color: colors.textFaint, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 10 },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingVertical: 20, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cardWrap: { width: CARD_W },
  card: { width: CARD_W, height: CARD_H, borderRadius: radius.lg, borderWidth: 2, overflow: 'hidden', backgroundColor: '#05050b' },
  activePill: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.territory, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  activeText: { color: '#04110C', fontSize: 10, fontWeight: '800' },
  explorer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 },
  explorerText: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },
  duelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.territory, paddingVertical: 16, borderRadius: radius.lg, marginTop: 16 },
  duelText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
