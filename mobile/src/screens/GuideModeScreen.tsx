import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Location from 'expo-location'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { api, ApiError } from '../api/client'
import { Button, Card, Loading, EmptyState, Badge } from '../components/ui'
import { MapView } from '../components/MapView'
import { StonePlacementAnimation } from '../components/StonePlacementAnimation'
import { colors, space } from '../theme'
import type { TripsStackParams } from '../navigation/types'
import type { CheckInResult, Trip } from '../api/types'

type Props = NativeStackScreenProps<TripsStackParams, 'GuideMode'>

// 체크인용 위치 읽기 — 지오펜스 판정이라 고정밀(GPS)이 적합.
// 8초 내 못 받으면 최근 캐시 위치로 폴백해 무한 대기를 막는다(실내·에뮬레이터 대비).
async function readPosition(): Promise<Location.LocationObject> {
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ])
  } catch {
    const last = await Location.getLastKnownPositionAsync({})
    if (last) return last
    throw new Error('위치를 가져올 수 없어요. 잠시 후 다시 시도해주세요.')
  }
}

export function GuideModeScreen({ route }: Props) {
  const { tripId } = route.params
  const { data, loading, error, reload } = useResource<Trip>(`/trips/${tripId}`, { auth: true, deps: [tripId] })
  const [busy, setBusy] = useState(false)
  const [placing, setPlacing] = useState(false)

  if (loading) return <Loading />
  if (error || !data) return <EmptyState text={error ?? '불러오기 실패'} />

  const next = data.nextVisit ?? data.visits.find((v) => v.status === 'PENDING') ?? null

  async function checkIn(force = false) {
    if (!next) return
    setBusy(true)
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (perm.status !== 'granted') {
        Alert.alert('위치 권한 필요', '체크인하려면 위치 권한을 허용해주세요.')
        return
      }
      const pos = await readPosition()
      const res = await api<CheckInResult>(`/trips/${tripId}/visits/${next!.id}/check-in`, {
        method: 'POST', auth: true,
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined, force },
      })
      setPlacing(true) // 착수의 손맛 — 바둑돌 놓기
      if (res.tripStatus === 'COMPLETED') Alert.alert('여행 완료!', '모든 스팟을 다 돌았어요. 리뷰를 남겨보세요.')
      reload()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CHECKIN_OUT_OF_RANGE') {
        const d = (e.details as { distanceM?: number })?.distanceM
        Alert.alert('아직 도착 전이에요', `목적지까지 약 ${d ?? '?'}m 남았어요.`, [
          { text: '취소', style: 'cancel' },
          { text: '그래도 체크인', onPress: () => checkIn(true) },
        ])
      } else {
        Alert.alert('오류', e instanceof ApiError ? e.message : '체크인 실패')
      }
    } finally {
      setBusy(false)
    }
  }

  async function skip() {
    if (!next) return
    setBusy(true)
    try {
      await api(`/trips/${tripId}/visits/${next!.id}/skip`, { method: 'POST', auth: true, body: {} })
      reload()
    } finally { setBusy(false) }
  }

  const pct = data.progress.total ? Math.round((data.progress.done / data.progress.total) * 100) : 0

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(5), gap: space(4) }}>
      {/* 카카오맵 — 키 설정 시 실제 지도, 없으면 플레이스홀더 (다음 목적지 중심) */}
      <MapView
        lat={next?.spot.lat ?? data.visits[0]?.spot.lat ?? 33.45}
        lng={next?.spot.lng ?? data.visits[0]?.spot.lng ?? 126.57}
        height={180}
        markers={data.visits.map((v) => ({ lat: v.spot.lat, lng: v.spot.lng, label: v.spot.name, done: v.status === 'DONE' }))}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{data.progress.done}/{data.progress.total} 완료</Text>
        <Badge label={data.status === 'ONGOING' ? '진행 중' : data.status === 'COMPLETED' ? '완료' : data.status} tone={data.status === 'COMPLETED' ? 'green' : 'orange'} />
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>

      {next ? (
        <Card style={{ padding: space(4), gap: 6 }}>
          <Text style={{ color: colors.textHint, fontSize: 12 }}>다음 목적지 · Day {next.dayNo}</Text>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{next.spot.name}</Text>
          <Text style={{ color: colors.textSub }}>{next.spot.category}</Text>
          <Button title={busy ? '확인 중…' : '도착했어요 (체크인)'} onPress={() => checkIn(false)} disabled={busy} style={{ marginTop: 8 }} />
          <Button title="이번 장소 건너뛰기" onPress={skip} kind="ghost" disabled={busy} />
        </Card>
      ) : (
        <Card style={{ padding: space(5) }}>
          <Text style={{ textAlign: 'center', color: colors.textSub }}>모든 스팟을 완료했어요 🎉</Text>
        </Card>
      )}

      <Text style={{ fontWeight: '600', color: colors.text, marginTop: 4 }}>전체 일정</Text>
      {data.visits.map((v) => (
        <View key={v.id} style={styles.visitRow}>
          <View style={[styles.dot, v.status === 'DONE' && { backgroundColor: colors.success }, v.status === 'SKIPPED' && { backgroundColor: colors.textHint }]} />
          <Text style={{ flex: 1, color: v.status === 'PENDING' ? colors.text : colors.textHint, textDecorationLine: v.status === 'SKIPPED' ? 'line-through' : 'none' }}>
            {v.spot.name}
          </Text>
          {v.status === 'DONE' && <Badge label={v.checkinType === 'MANUAL' ? '수동' : '체크인'} tone="green" />}
        </View>
      ))}
    </ScrollView>
      {placing && <StonePlacementAnimation onDone={() => setPlacing(false)} />}
    </View>
  )
}

const styles = StyleSheet.create({
  mapPh: { height: 180, backgroundColor: colors.bg2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.bg2, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bg2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line },
})
