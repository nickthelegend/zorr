import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { ArrowLeft, Check, Link2, Sparkles, Swords, WifiOff } from 'lucide-react-native'
import { ActivityIndicator, Dimensions, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SvgUri } from 'react-native-svg'

import { CTA, GlowCard, Press } from '../components/ui'
import { generateBeast, RARITY_COLOR } from '../features/beasts/beast'
import { beastImage } from '../features/beasts/beast-art'
import { ELEMENT_META } from '../features/beasts/element'
import { useGame } from '../features/game/game-store'
import { assetExplorerUrl } from '../features/nft/nft'
import { playSfx } from '../features/core/audio'
import { failHaptic, winHaptic } from '../features/core/haptics'
import { pushNote } from '../features/core/notifications-store'
import { useGuardians } from '../features/nft/use-guardians'
import { colors, fonts, radius } from '../theme'

const COLS = 2
const GAP = 12
const CARD_W = (Dimensions.get('window').width - 40 - GAP) / COLS
// Square — the Genesis art is 1:1, so the full beast fits with no side-crop.
const CARD_H = CARD_W

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
          <GlowCard borderTint={colors.primary} tint={colors.primary} glow={colors.primary} contentStyle={styles.dropCard}>
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

            <CTA
              label={g.pool?.remaining === 0 ? 'Pool claimed out' : 'Claim from Genesis Drop'}
              icon={<Sparkles color={colors.text} size={20} />}
              palette={['#8B5CF6', '#4C1D95']}
              textColor={colors.text}
              onPress={async () => {
                const beast = await g.claim()
                if (beast) {
                  winHaptic()
                  playSfx('shield')
                  pushNote({ kind: 'guardian', title: '✨ Guardian summoned', body: `${beast.name} joined your roster — a Genesis NFT drawn by VRF` })
                } else {
                  failHaptic()
                }
              }}
              loading={g.claiming}
              disabled={!g.online || g.pool?.remaining === 0}
              style={{ marginTop: 14 }}
            />
            <Text style={styles.claimHint}>
              {g.claiming ? 'MagicBlock VRF is drawing your Guardian…' : 'A random unclaimed NFT, picked by verifiable VRF.'}
            </Text>
            {g.error ? <Text style={styles.err}>{g.error}</Text> : null}
            {!g.online ? (
              <Text style={styles.err}>Start the claim relay (npm run relay in /nft) and set EXPO_PUBLIC_CLAIM_RELAY_URL.</Text>
            ) : null}
          </GlowCard>
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
              const art = beastImage(b.seed, b.element, b.name)
              const el = ELEMENT_META[b.element as keyof typeof ELEMENT_META]
              const power = generateBeast(b.seed).power
              const rar = RARITY_COLOR[b.rarity as keyof typeof RARITY_COLOR] ?? colors.primary
              return (
                <Animated.View key={b.asset} entering={FadeIn.delay(60 + i * 40)} style={styles.cardWrap}>
                  <Press onPress={() => game.setActiveBeast(b.seed)}>
                    <View
                      style={[
                        styles.card,
                        { borderColor: active ? rar : colors.hairline, backgroundColor: `${el?.color ?? '#7C3AED'}14` },
                        active && { shadowColor: rar, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
                      ]}
                    >
                      {art ? (
                        <Image source={art} style={styles.cardArt} resizeMode="cover" />
                      ) : (
                        <SvgUri uri={b.image} width={CARD_W - 4} height={CARD_H - 4} />
                      )}
                      <LinearGradient colors={['transparent', 'rgba(4,4,10,0.12)', 'rgba(4,4,10,0.94)']} style={styles.cardShade}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {b.name}
                        </Text>
                        <View style={styles.cardMeta}>
                          <Text style={[styles.cardEl, { color: el?.color ?? colors.primary }]} numberOfLines={1}>
                            {el?.label ?? b.element} · {b.rarity}
                          </Text>
                          <Text style={styles.cardPwr}>{power}</Text>
                        </View>
                      </LinearGradient>
                    </View>
                    {active ? (
                      <View style={styles.activePill}>
                        <Check color="#04110C" size={11} />
                        <Text style={styles.activeText}>Active</Text>
                      </View>
                    ) : null}
                  </Press>
                  <TouchableOpacity style={styles.explorer} onPress={() => Linking.openURL(assetExplorerUrl(b.asset))}>
                    <Link2 color={colors.textDim} size={12} />
                    <Text style={styles.explorerText}>{short(b.asset)}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )
            })}
          </View>
        )}

        <CTA
          label="To the Arena"
          icon={<Swords color="#04110C" size={20} />}
          onPress={() => router.push('/battle')}
          style={{ marginTop: 16 }}
        />
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
  dropCard: { padding: 18 },
  dropTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  poolText: { color: colors.territory, fontFamily: fonts.mono, fontSize: 13 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offlineText: { color: colors.gold, fontSize: 12 },
  ownerLine: { color: colors.textFaint, fontSize: 12, fontFamily: fonts.data, marginTop: 6 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: radius.lg, marginTop: 14 },
  claimText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  claimHint: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 8 },
  err: { color: colors.enemy, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  section: { color: colors.textFaint, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 10 },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingVertical: 20, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cardWrap: { width: CARD_W },
  card: { width: CARD_W, height: CARD_H, borderRadius: radius.lg, borderWidth: 2, overflow: 'hidden', backgroundColor: '#05050b' },
  cardArt: { width: '100%', height: '100%' },
  cardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 11, paddingTop: 28, paddingBottom: 10 },
  cardName: { color: '#fff', fontFamily: fonts.display, fontSize: 14.5 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 2 },
  cardEl: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 },
  cardPwr: { color: colors.gold, fontSize: 17, fontFamily: fonts.display, marginLeft: 6 },
  activePill: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.territory, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  activeText: { color: '#04110C', fontSize: 10, fontWeight: '800' },
  explorer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 },
  explorerText: { color: colors.textDim, fontSize: 11, fontFamily: fonts.data },
  duelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.territory, paddingVertical: 16, borderRadius: radius.lg, marginTop: 16 },
  duelText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
