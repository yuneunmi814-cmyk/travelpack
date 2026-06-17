import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { colors, radius } from '../theme'

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Pill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  )
}

export function Badge({ label, tone = 'gray' }: { label: string; tone?: 'gray' | 'orange' | 'green' | 'navy' }) {
  const map = {
    gray: { bg: colors.bg2, fg: colors.textSub },
    orange: { bg: colors.primaryWeak, fg: colors.primaryDeep },
    green: { bg: '#E7F7EF', fg: '#0E7A4B' },
    navy: { bg: '#E8EDF5', fg: colors.navy },
  }[tone]
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[styles.badgeText, { color: map.fg }]}>{label}</Text>
    </View>
  )
}

export function Button({ title, onPress, kind = 'primary', disabled, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'navy'; disabled?: boolean; style?: ViewStyle
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'navy' && styles.btnNavy,
        kind === 'ghost' && styles.btnGhost,
        (disabled || pressed) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}
    >
      <Text style={[styles.btnText, kind === 'ghost' && { color: colors.textSub }]}>{title}</Text>
    </Pressable>
  )
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
}

export function EmptyState({ text, onRetry, action }: { text: string; onRetry?: () => void; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.textHint, textAlign: 'center', marginBottom: onRetry || action ? 14 : 0 }}>{text}</Text>
      {onRetry && <Button title="다시 시도" onPress={onRetry} kind="navy" />}
      {action && <Button title={action.label} onPress={action.onPress} style={{ paddingHorizontal: 28 }} />}
    </View>
  )
}

export function ImagePlaceholder({ height, label }: { height: number; label?: string }) {
  return (
    <View style={[styles.imgPh, { height }]}>
      <Text style={{ color: colors.textHint, fontSize: 12 }}>{label ?? '이미지'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, overflow: 'hidden' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.bg2 },
  pillActive: { backgroundColor: colors.primaryWeak },
  pillText: { fontSize: 12, color: colors.textSub },
  pillTextActive: { color: colors.primaryDeep, fontWeight: '600' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  btn: { paddingVertical: 13, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnNavy: { backgroundColor: colors.navy },
  btnGhost: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  imgPh: { backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
})
