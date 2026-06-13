import { useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, ImagePlaceholder, Loading, EmptyState, Pill, Badge } from '../components/ui'
import { MapView } from '../components/MapView'
import { BookmarkButton } from '../components/BookmarkButton'
import { colors, space } from '../theme'
import { priceLabel } from '../lib/format'
import type { ExploreStackParams } from '../navigation/types'
import type { CourseDetail, Trip } from '../api/types'

type Props = NativeStackScreenProps<ExploreStackParams, 'CourseDetail'>

const TRANSPORT: Record<string, string> = { WALK: '도보', BUS: '버스', TAXI: '택시', CAR: '자동차' }

export function CourseDetailScreen({ navigation, route }: Props) {
  const { isAuthed } = useAuth()
  const { data, loading, error, reload } = useResource<CourseDetail>(`/courses/${route.params.courseId}`, { auth: true, deps: [route.params.courseId] })
  const [day, setDay] = useState(1)
  const [starting, setStarting] = useState(false)
  const [buying, setBuying] = useState(false)
  const [agreed, setAgreed] = useState(false)

  if (loading) return <Loading />
  if (error || !data) return <EmptyState text={error ?? '불러오기 실패'} />

  const locked = data.locked
  const isPaid = data.price > 0
  const dayData = data.days.find((d) => d.dayNo === day) ?? data.days[0]

  async function startTrip() {
    if (!isAuthed) {
      Alert.alert('로그인이 필요해요', '여행을 시작하려면 로그인하세요.')
      return
    }
    setStarting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const trip = await api<Trip>('/trips', { method: 'POST', auth: true, body: { courseId: data!.id, startDate: today } })
      const parent = navigation.getParent() as { navigate: (name: string, params: unknown) => void } | undefined
      parent?.navigate('TripsTab', { screen: 'GuideMode', params: { tripId: trip.id } })
    } catch (e) {
      Alert.alert('오류', e instanceof ApiError ? e.message : '여행 생성 실패')
    } finally {
      setStarting(false)
    }
  }

  async function doPurchase() {
    setBuying(true)
    try {
      await api(`/marketplace/courses/${data!.id}/purchase`, { method: 'POST', auth: true })
      Alert.alert('구매 완료', '전체 일정이 열렸어요!')
      reload()
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        Alert.alert('결제 준비 중', '유료 결제는 곧 오픈돼요. 조금만 기다려 주세요.')
      } else {
        Alert.alert('구매 실패', e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요')
      }
    } finally {
      setBuying(false)
    }
  }

  function purchase() {
    if (!isAuthed) {
      Alert.alert('로그인이 필요해요', '구매하려면 로그인하세요.')
      return
    }
    if (!agreed) {
      Alert.alert('동의가 필요해요', '청약철회 제한 안내에 동의해 주세요.')
      return
    }
    Alert.alert('여행팩 구매', `${priceLabel(data!.price)}을 결제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '구매하기', onPress: doPurchase },
    ])
  }

  const allSpots = data.days.flatMap((d) => d.items.map((it) => it.spot))
  const mapSpots = allSpots.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(6) }}>
        {data.cover ? <Image source={{ uri: data.cover }} style={{ height: 200, width: '100%' }} /> : <ImagePlaceholder height={160} />}
        <View style={{ padding: space(5), gap: space(3) }}>
          <Text style={styles.title}>{data.title}</Text>
          {data.summary && <Text style={{ color: colors.textSub }}>{data.summary}</Text>}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Pill label={`${data.durationDays}일`} />
            <Pill label={`명소 ${data.spotCount}곳`} />
            {data.estCost ? <Pill label={`약 ${Math.round(data.estCost / 10000)}만원`} /> : null}
            {data.authorType === 'USER' && data.author && <Badge label={`by ${data.author.nickname}`} tone="navy" />}
            {isPaid && <Badge label={priceLabel(data.price)} tone="orange" />}
          </View>

          {locked && (
            <Card style={{ padding: space(4), gap: 4, backgroundColor: colors.primaryWeak, borderColor: colors.primaryWeak }}>
              <Text style={{ fontWeight: '700', color: colors.primaryDeep }}>🔒 1일차 미리보기</Text>
              <Text style={{ color: colors.primaryDeep, fontSize: 13 }}>
                구매하면 전체 일정·지도·체크인 가이드를 모두 볼 수 있어요.
              </Text>
            </Card>
          )}

          {!locked && data.days.length > 1 && (
            <View style={{ flexDirection: 'row', gap: space(4), borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 6 }}>
              {data.days.map((d) => (
                <Pressable key={d.dayNo} onPress={() => setDay(d.dayNo)}>
                  <Text style={[styles.dayTab, day === d.dayNo && styles.dayTabActive]}>Day {d.dayNo}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* 잠금 시: 1일차 스팟명만 미리보기 */}
          {locked
            ? data.days[0]?.items.map((it, idx) => (
                <View key={idx} style={styles.step}>
                  <View style={styles.stepDot} />
                  <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>{it.spot.name}</Text>
                  <Text style={{ color: colors.textHint, fontSize: 12 }}>{it.spot.category}</Text>
                </View>
              ))
            : dayData?.items.map((it, idx) => (
                <View key={it.id ?? idx}>
                  <Pressable onPress={() => navigation.navigate('SpotDetail', { spotId: it.spot.id })} style={styles.step}>
                    <View style={styles.stepNo}><Text style={{ color: colors.white, fontWeight: '700', fontSize: 11 }}>{it.order}</Text></View>
                    <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>{it.spot.name}</Text>
                    {it.stayMinutes ? <Text style={{ color: colors.textHint, fontSize: 12 }}>{it.stayMinutes}분</Text> : null}
                  </Pressable>
                  {it.transportToNext && idx < dayData.items.length - 1 && (
                    <Text style={styles.transport}>{TRANSPORT[it.transportToNext]} {it.transportMinutes ?? ''}분</Text>
                  )}
                </View>
              ))}

          {locked && data.durationDays > 1 && (
            <Text style={{ color: colors.textHint, fontSize: 13, textAlign: 'center', paddingVertical: 4 }}>
              + Day 2~{data.durationDays} 일정이 더 있어요
            </Text>
          )}

          {!locked && mapSpots.length > 0 && (
            <MapView lat={mapSpots[0]!.lat!} lng={mapSpots[0]!.lng!} height={160} style={{ marginTop: 4 }}
              markers={mapSpots.map((s) => ({ lat: s.lat!, lng: s.lng!, label: s.name }))} />
          )}

          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}
            onPress={() => navigation.navigate('ReviewWrite', { targetType: 'COURSE', targetId: data!.id, targetName: data!.title })}
          >
            <Text style={{ color: colors.text }}>
              {data.reviewSummary.avg != null ? `★ ${data.reviewSummary.avg} · 리뷰 ${data.reviewSummary.count}` : '아직 리뷰가 없어요'}
            </Text>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>리뷰 쓰기</Text>
          </Pressable>
        </View>
      </ScrollView>

      {locked ? (
        <View style={styles.ctaCol}>
          <Pressable onPress={() => setAgreed((a) => !a)} style={styles.consent}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>{agreed && <Text style={styles.checkMark}>✓</Text>}</View>
            <Text style={styles.consentText}>구매 즉시 전체 일정이 공개되며, 디지털콘텐츠 특성상 청약철회(환불)가 제한될 수 있음에 동의합니다.</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={styles.saveBtn}><BookmarkButton targetType="COURSE" targetId={data.id} initial={data.isBookmarked} /></View>
            <Button title={buying ? '처리 중…' : `구매 · ${priceLabel(data.price)}`} onPress={purchase} disabled={buying || !agreed} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={styles.cta}>
          <View style={styles.saveBtn}><BookmarkButton targetType="COURSE" targetId={data.id} initial={data.isBookmarked} /></View>
          <Button title={starting ? '시작하는 중…' : '이 코스로 여행 시작'} onPress={startTrip} disabled={starting} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  dayTab: { color: colors.textSub, fontWeight: '600' },
  dayTabActive: { color: colors.primary, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  stepNo: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textHint, marginHorizontal: 5 },
  transport: { color: colors.textHint, fontSize: 12, paddingLeft: 26, paddingVertical: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  ctaCol: { gap: space(3), padding: space(4), borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  saveBtn: { width: 48, height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '800' },
  consentText: { flex: 1, fontSize: 12, color: colors.textSub, lineHeight: 17 },
})
