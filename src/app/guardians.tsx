import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Check, Link2, Sparkles, Swords } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BeastCard } from '../components/beast-card'
import { generateBeast } from '../features/beasts/beast'
import { explorerTxUrl, mintGuardianOnChain, UnfundedError } from '../features/chain/claim'
import { useGame } from '../features/game/game-store'
import { colors, fonts, radius } from '../theme'

type MintState = { status: 'idle' | 'minting' | 'done' | 'local'; sig?: string }

export default function GuardiansScreen() {
  const game = useGame()
  const [mint, setMint] = useState<MintState>({ status: 'idle' })

  const summon = async () => {
    setMint({ status: 'minting' })
    const seed = game.mintBeast()
    const beast = generateBeast(seed)
    try {
      const sig = await mintGuardianOnChain(seed, beast.name)
      setMint({ status: 'done', sig })
    } catch (e) {
      // Minted locally regardless; on-chain registration just needs a funded wallet.
      setMint({ status: e instanceof UnfundedError ? 'local' : 'local' })
    }
  }

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
          Your Guardians are NFT monsters — each one’s stats, element and abilities are sealed by its seed. Send one into
          a duel over Bluetooth or online.
        </Text>

        {/* Summon */}
        <Animated.View entering={FadeInDown.delay(40)}>
          <TouchableOpacity activeOpacity={0.9} onPress={summon} disabled={mint.status === 'minting'}>
            <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.summon}>
              {mint.status === 'minting' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Sparkles color={colors.text} size={20} />
                  <Text style={styles.summonText}>Summon Guardian</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {mint.status === 'done' && mint.sig ? (
          <TouchableOpacity style={styles.txRow} onPress={() => Linking.openURL(explorerTxUrl(mint.sig!))}>
            <Link2 color={colors.territory} size={14} />
            <Text style={styles.txText}>Registered on-chain — view transaction</Text>
          </TouchableOpacity>
        ) : mint.status === 'local' ? (
          <Text style={styles.localNote}>Summoned. Fund the Zorr wallet with devnet SOL to register it on-chain.</Text>
        ) : null}

        {/* Roster */}
        <Text style={styles.section}>Your roster · {game.beasts.length}</Text>
        <View style={styles.roster}>
          {game.beasts.map((seed, i) => {
            const active = seed === game.activeBeast
            return (
              <Animated.View key={seed} entering={FadeInDown.delay(80 + i * 40)}>
                <View style={styles.slot}>
                  <BeastCard seed={seed} selected={active} onPress={() => game.setActiveBeast(seed)} />
                  {active ? (
                    <View style={styles.activePill}>
                      <Check color="#04110C" size={12} />
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            )
          })}
        </View>

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
  summon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: radius.lg },
  summonText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  txText: { color: colors.territory, fontSize: 13 },
  localNote: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  section: { color: colors.textFaint, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 10 },
  roster: { gap: 12 },
  slot: { position: 'relative' },
  activePill: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.territory, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  activePillText: { color: '#04110C', fontSize: 10, fontWeight: '800' },
  duelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.territory, paddingVertical: 16, borderRadius: radius.lg, marginTop: 10 },
  duelText: { color: '#04110C', fontSize: 16, fontWeight: '800' },
})
