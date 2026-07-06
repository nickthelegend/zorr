import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { ArrowRight, Flag, Footprints, Wallet } from 'lucide-react-native'
import LottieView from 'lottie-react-native'
import { useRef, useState } from 'react'
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, fonts, radius } from '../theme'

const { width } = Dimensions.get('window')

const onboardingData = [
  {
    id: '1',
    title: 'Own the Map',
    description:
      'Your Solana wallet, your turf. Every tile you capture is minted on-chain — instant and gasless on MagicBlock Ephemeral Rollups.',
    lottieSource: require('../../assets/lottie/wallet.json'),
    icon: Wallet,
  },
  {
    id: '2',
    title: 'Walk to Conquer',
    description:
      'Move through the real world to claim land. Your steps are your power — anti-cheat blocks spoofing and vehicles, so only real walkers win.',
    lottieSource: require('../../assets/lottie/connect.json'),
    icon: Footprints,
  },
  {
    id: '3',
    title: 'Capture the Land',
    description:
      'Paint the map in your color, defend your zones from rivals, and climb the live leaderboard in real time.',
    lottieSource: require('../../assets/lottie/quest.json'),
    icon: Flag,
  },
]

const renderItem = ({ item }: { item: (typeof onboardingData)[0] }) => {
  const Icon = item.icon
  return (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <LottieView source={item.lottieSource} autoPlay loop style={styles.lottie} />
      </View>
      <BlurView intensity={40} tint="dark" style={styles.contentCard}>
        <LinearGradient colors={['rgba(124, 58, 237, 0.1)', 'rgba(0, 0, 0, 0)']} style={StyleSheet.absoluteFill} />
        <View style={styles.iconContainer}>
          <Icon size={32} color={colors.primary} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </BlurView>
    </View>
  )
}

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)

  const finish = async () => {
    await SecureStore.setItemAsync('onboardingCompleted', 'true')
    router.replace('/login')
  }

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const next = currentIndex + 1
      setCurrentIndex(next)
      flatListRef.current?.scrollToIndex({ index: next, animated: true })
    } else {
      finish()
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.header}>
        <Text style={styles.brand}>ZORR</Text>
        <TouchableOpacity onPress={finish} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          setCurrentIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }}
      />

      <Animated.View entering={FadeIn} style={styles.footer}>
        <View style={styles.paginationContainer}>
          {onboardingData.map((_, index) => (
            <View key={index} style={[styles.paginationDot, index === currentIndex && styles.paginationDotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextButtonText}>
            {currentIndex === onboardingData.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <ArrowRight size={20} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brand: { color: colors.text, fontFamily: fonts.display, fontSize: 20, letterSpacing: 2 },
  skipButton: { padding: 8 },
  skipText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  slide: { width, padding: 16, alignItems: 'center', justifyContent: 'center' },
  imageContainer: {
    width: width * 0.8,
    height: width * 0.8,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: { width: '100%', height: '100%' },
  contentCard: {
    width: '100%',
    padding: 24,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: { fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  footer: { padding: 24 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textFaint,
    marginHorizontal: 4,
  },
  paginationDotActive: { backgroundColor: colors.primary, width: 24 },
  nextButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
})
