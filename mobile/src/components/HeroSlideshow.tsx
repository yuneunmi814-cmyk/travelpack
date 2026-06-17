import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native'
import { colors } from '../theme'

// 코스에 포함된 관광지 사진들을 자동으로 크로스페이드 전환해 '영상처럼' 보여주는 히어로.
// 정적 이미지 여러 장을 일정 간격으로 부드럽게 넘긴다(서버 영상 렌더 없이 동영상 느낌).
export function HeroSlideshow({
  images,
  height = 200,
  intervalMs = 2800,
  style,
}: {
  images: string[]
  height?: number
  intervalMs?: number
  style?: ViewStyle
}) {
  const [index, setIndex] = useState(0)
  // 각 이미지의 불투명도 (첫 장만 1, 나머지 0) — 마운트 시 1회 생성
  const opacities = useRef(images.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current

  // 자동 전환 타이머 (사진 2장 이상일 때만)
  useEffect(() => {
    if (images.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs)
    return () => clearInterval(t)
  }, [images.length, intervalMs])

  // index 변경 시 크로스페이드
  useEffect(() => {
    Animated.parallel(
      opacities.map((op, i) =>
        Animated.timing(op, { toValue: i === index ? 1 : 0, duration: 650, useNativeDriver: true }),
      ),
    ).start()
  }, [index, opacities])

  if (images.length === 0) return null

  return (
    <View style={[{ height, width: '100%', backgroundColor: colors.bg2 }, style]}>
      {images.map((uri, i) => (
        <Animated.Image
          key={`${uri}-${i}`}
          source={{ uri }}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}
        />
      ))}
      {images.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 16, backgroundColor: '#fff' },
})
