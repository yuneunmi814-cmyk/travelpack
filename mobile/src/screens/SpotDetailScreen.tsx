import { useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View, Image, StyleSheet } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { Button, Card, ImagePlaceholder, Loading, EmptyState, Badge } from '../components/ui'
import { BookmarkButton } from '../components/BookmarkButton'
import { openDirections } from '../lib/directions'
import { AudioGuideList } from '../components/AudioGuideList'
import { VideoRail } from '../components/VideoRail'
import { MapView } from '../components/MapView'
import { colors, space } from '../theme'
import type { ExploreStackParams } from '../navigation/types'
import type { SpotDetail } from '../api/types'

type Props = NativeStackScreenProps<ExploreStackParams, 'SpotDetail'>

export function SpotDetailScreen({ navigation, route }: Props) {
  const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const { data, loading, error } = useResource<SpotDetail>(
    `/spots/${route.params.spotId}${lang === 'en' ? '?lang=en' : ''}`,
    { deps: [route.params.spotId, lang] },
  )
  if (loading) return <Loading />
  if (error || !data) return <EmptyState text={error ?? '불러오기 실패'} />

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: space(8) }}>
      {data.images.length > 0 ? (
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {data.images.map((img, i) => (
              <Image key={i} source={{ uri: img.url }} style={{ height: 220, width: SCREEN_W }} />
            ))}
          </ScrollView>
          {data.images.length > 1 && (
            <View style={styles.countBadge}><Text style={styles.countText}>1+ / {data.images.length}</Text></View>
          )}
        </View>
      ) : <ImagePlaceholder height={160} />}
      <View style={{ padding: space(5), gap: space(3) }}>
        <View style={{ flexDirection: 'row', alignSelf: 'flex-end' }}>
          <View style={styles.langToggle}>
            {(['ko', 'en'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.langBtn, lang === l && styles.langBtnOn]}>
                <Text style={[styles.langText, lang === l && styles.langTextOn]}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.title}>{data.name}</Text>
          <Badge label={data.category} />
          {data.reviewSummary.avg != null && <Text style={{ color: colors.primary, fontWeight: '700' }}>★ {data.reviewSummary.avg}</Text>}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <BookmarkButton targetType="SPOT" targetId={data.id} initial={data.isBookmarked} size={22} />
          </View>
        </View>

        {(data.petInfo || data.barrierFree) && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {data.petInfo && <Badge label="🐾 반려동물 동반" tone="navy" />}
            {data.barrierFree && <Badge label="♿ 무장애 편의" tone="navy" />}
          </View>
        )}

        <Card style={{ padding: space(4) }}>
          <Row label="운영시간" value={data.todayHours ?? '정보 없음'} accent={data.todayOpen === true ? '영업 중' : data.todayOpen === false ? '영업 종료' : undefined} />
          {data.admissionFee && <Row label="입장료" value={data.admissionFee} />}
          {data.avgStayMinutes && <Row label="체류" value={`평균 ${data.avgStayMinutes}분`} />}
          {data.address && <Row label="주소" value={data.address} />}
          {data.phone && <Row label="전화" value={data.phone} />}
        </Card>

        <Button title="🧭 길찾기 (지도 앱으로 안내)" kind="navy" onPress={() => openDirections(data.lat, data.lng, data.name)} />

        <MapView lat={data.lat} lng={data.lng} markers={[{ lat: data.lat, lng: data.lng, label: data.name }]} height={160} zoomLevel={15} />

        {data.tips && (
          <View style={styles.tip}>
            <Text style={{ color: colors.primaryDeep, fontWeight: '700', marginBottom: 4 }}>💡 에디터 꿀팁</Text>
            <Text style={{ color: colors.primaryDeep, lineHeight: 20 }}>{data.tips}</Text>
          </View>
        )}

        <AudioGuideList guides={data.audioGuides} />

        {data.videos?.length > 0 && <VideoRail title="🎬 여행 영상" videos={data.videos} />}

        {data.petInfo && <InfoSection title="🐾 반려동물 동반여행" data={data.petInfo} />}
        {data.barrierFree && <InfoSection title="♿ 무장애 여행 정보" data={data.barrierFree} />}

        {data.relatedSpots && data.relatedSpots.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={styles.section}>함께 가는 관광지</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {data.relatedSpots.map((r, i) => (
                <View key={i} style={styles.relChip}>
                  <Text style={{ color: colors.text, fontSize: 12 }}>{r.name}</Text>
                  {r.category && <Text style={{ color: colors.textHint, fontSize: 10 }}> · {r.category}</Text>}
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: colors.textHint }}>출처: 한국관광 데이터랩(연관 관광지)</Text>
          </View>
        )}

        {data.description && <Text style={{ color: colors.textSub, lineHeight: 22 }}>{data.description}</Text>}

        {data.nearbySpots.length > 0 && (
          <>
            <Text style={styles.section}>주변 추천</Text>
            {data.nearbySpots.map((n) => (
              <View key={n.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bg2 }}>
                <Text style={{ color: colors.text }}>{n.name}</Text>
                <Text style={{ color: colors.textHint }}>{Math.round(n.distanceM)}m</Text>
              </View>
            ))}
          </>
        )}

        <Pressable
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}
          onPress={() => navigation.navigate('ReviewWrite', { targetType: 'SPOT', targetId: data!.id, targetName: data!.name })}
        >
          <Text style={{ color: colors.textSub }}>리뷰 {data.reviewSummary.count}개</Text>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>리뷰 쓰기</Text>
        </Pressable>

        {data.images[0]?.credit && <Text style={{ fontSize: 11, color: colors.textHint }}>이미지 출처: {data.images[0].credit}</Text>}
      </View>
    </ScrollView>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5, alignItems: 'center' }}>
      <Text style={{ width: 56, color: colors.textSub, fontSize: 13 }}>{label}</Text>
      <Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>{value}</Text>
      {accent && <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>{accent}</Text>}
    </View>
  )
}

// 공공데이터 정보(반려동물·무장애) — 키:값 카드
function InfoSection({ title, data }: { title: string; data: Record<string, string> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.section}>{title}</Text>
      <Card style={{ padding: space(4), gap: 8 }}>
        {Object.entries(data).map(([k, v]) => (
          <View key={k} style={{ gap: 2 }}>
            <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: '700' }}>{k}</Text>
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>{v}</Text>
          </View>
        ))}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  section: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 8 },
  relChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  tip: { backgroundColor: colors.primaryWeak, borderRadius: 10, padding: space(4) },
  countBadge: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  countText: { color: '#fff', fontSize: 11 },
  langToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 999, overflow: 'hidden' },
  langBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  langBtnOn: { backgroundColor: colors.primary },
  langText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  langTextOn: { color: colors.white },
})

const SCREEN_W = Dimensions.get('window').width
