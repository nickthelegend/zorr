import { LinearGradient } from 'expo-linear-gradient'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { beastImage } from '../features/beasts/beast-art'
import { generateBeast, RARITY_COLOR } from '../features/beasts/beast'
import { ELEMENT_META } from '../features/beasts/element'
import { colors, fonts, radius } from '../theme'

/** A Guardian card rendered straight from its seed. Two densities: full + compact. */
export function BeastCard({
  seed,
  level = 1,
  selected,
  onPress,
  compact,
}: {
  seed: string
  level?: number
  selected?: boolean
  onPress?: () => void
  compact?: boolean
}) {
  const beast = generateBeast(seed, level)
  const el = ELEMENT_META[beast.element]
  const rarity = RARITY_COLOR[beast.rarity]
  const art = beastImage(seed, beast.element, beast.name)

  const body = (
    <LinearGradient
      colors={[`${el.color}22`, 'rgba(0,0,0,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, compact && styles.cardCompact, { borderColor: selected ? el.color : colors.border }]}
    >
      <View style={styles.row}>
        <View style={[styles.crest, { borderColor: el.color, backgroundColor: `${el.color}1A` }]}>
          {art ? <Image source={art} style={styles.crestImg} resizeMode="cover" /> : <Text style={styles.glyph}>{beast.glyph}</Text>}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {beast.name}
          </Text>
          <View style={styles.badges}>
            <Text style={[styles.badge, { color: el.color, borderColor: `${el.color}55` }]}>{el.label}</Text>
            <Text style={[styles.badge, { color: rarity, borderColor: `${rarity}55` }]}>{beast.rarity}</Text>
            <Text style={styles.lvl}>Lv {beast.level}</Text>
          </View>
        </View>
        <View style={styles.powerWrap}>
          <Text style={styles.powerNum}>{beast.power}</Text>
          <Text style={styles.powerLbl}>PWR</Text>
        </View>
      </View>

      {!compact ? (
        <View style={styles.stats}>
          <Stat label="ATK" value={beast.stats.attack} />
          <Stat label="DEF" value={beast.stats.defense} />
          <Stat label="SPD" value={beast.stats.speed} />
          <Stat label="MAG" value={beast.stats.magic} />
          <Stat label="HP" value={beast.maxHealth} />
        </View>
      ) : null}
    </LinearGradient>
  )

  if (!onPress) return body
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      {body}
    </TouchableOpacity>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 14 },
  cardCompact: { padding: 12, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crest: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  crestImg: { width: '100%', height: '100%' },
  glyph: { fontSize: 26 },
  info: { flex: 1, gap: 6 },
  name: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lvl: { color: colors.textDim, fontSize: 11, fontFamily: fonts.mono },
  powerWrap: { alignItems: 'center' },
  powerNum: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  powerLbl: { color: colors.textFaint, fontSize: 9, letterSpacing: 1 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 14 },
  statLbl: { color: colors.textFaint, fontSize: 9, letterSpacing: 1, marginTop: 2 },
})
