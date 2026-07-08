import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'

/**
 * Static nebula backdrop — a calm, layered wash of violet over pure black.
 * Deliberately NOT animated: Android renders drifting gradient blobs with hard
 * edges (BlurView barely blurs there), which reads cheap. Stillness reads
 * premium; the game's motion lives in the content, not the wallpaper.
 */
export function Aurora() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Deep violet-black vertical wash */}
      <LinearGradient
        colors={['#0C0716', '#06040B', '#000000']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Faint brand glow bleeding from the top edge */}
      <LinearGradient
        colors={['rgba(124,58,237,0.14)', 'rgba(124,58,237,0)']}
        style={styles.top}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Whisper of emerald grounding the bottom */}
      <LinearGradient
        colors={['rgba(34,211,166,0)', 'rgba(34,211,166,0.05)']}
        style={styles.bottom}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%' },
})
