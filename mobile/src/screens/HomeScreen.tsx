import { ScrollView, Text, View, Pressable, StyleSheet, Image } from 'react-native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { useResource } from '../api/useResource'
import { Card, ImagePlaceholder, Loading, EmptyState, Pill } from '../components/ui'
import { colors, space } from '../theme'
import type { TabParams } from '../navigation/types'
import type { CourseCard, HomeFeed, Region } from '../api/types'

type Props = BottomTabScreenProps<TabParams, 'HomeTab'>

export function HomeScreen({ navigation }: Props) {
  const { data, loading, error } = useResource<HomeFeed>('/home')

  function openCourse(courseId: string) {
    navigation.navigate('ExploreTab', { screen: 'CourseDetail', params: { courseId } })
  }
  function openRegion(r: Region) {
    navigation.navigate('ExploreTab', { screen: 'CourseList', params: { regionId: r.id, regionName: r.name } })
  }
  function openMarketplace() {
    navigation.navigate('ExploreTab', { screen: 'Marketplace' })
  }

  if (loading) return <Loading />
  if (error || !data) return <EmptyState text={error ?? '불러오기 실패'} />

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(5), gap: space(5) }}>
      <Text style={styles.brand}>TravelPack</Text>

      {data.banners[0] && (
        <Card style={{ backgroundColor: colors.navy }}>
          <View style={{ padding: space(5) }}>
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>{data.banners[0].title}</Text>
            <Text style={{ color: '#B9C4D6', fontSize: 12, marginTop: 4 }}>에디터가 다녀온 코스 모음</Text>
          </View>
        </Card>
      )}

      <Pressable onPress={openMarketplace}>
        <Card style={{ backgroundColor: colors.primaryWeak, borderColor: colors.primaryWeak }}>
          <View style={{ padding: space(5), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.primaryDeep, fontWeight: '800', fontSize: 15 }}>🧳 크리에이터 마켓플레이스</Text>
              <Text style={{ color: colors.primaryDeep, fontSize: 12, marginTop: 4 }}>여행 고수의 코스를 사고, 내 코스를 팔아보세요</Text>
            </View>
            <Text style={{ color: colors.primaryDeep, fontSize: 22, fontWeight: '700' }}>›</Text>
          </View>
        </Card>
      </Pressable>

      <Section title="이번 주 추천 코스">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
          {data.recommendedCourses.map((c) => (
            <Pressable key={c.id} onPress={() => openCourse(c.id)} style={{ width: 180 }}>
              <Card>
                {c.cover ? <Image source={{ uri: c.cover }} style={{ height: 96, width: '100%' }} /> : <ImagePlaceholder height={96} />}
                <View style={{ padding: space(3) }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.meta}>{c.durationDays > 1 ? `${c.durationDays - 1}박${c.durationDays}일` : '당일'} · 명소 {c.spotCount}곳</Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      </Section>

      <Section title="어디로 떠날까요">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          {data.popularRegions.map((r) => (
            <Pressable key={r.id} onPress={() => openRegion(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pill label={`${r.name}${r.courseCount ? ` ${r.courseCount}` : ''}`} active={r.trending} />
              {r.trending && <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>인기</Text>}
            </Pressable>
          ))}
        </View>
      </Section>

      {data.themeSections.map((s) => (
        <Section key={s.theme.id} title={s.theme.name}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
            {s.courses.map((c: CourseCard) => (
              <Pressable key={c.id} onPress={() => openCourse(c.id)} style={{ width: 160 }}>
                <Card>
                  {c.cover ? <Image source={{ uri: c.cover }} style={{ height: 80, width: '100%' }} /> : <ImagePlaceholder height={80} />}
                  <View style={{ padding: space(3) }}><Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text></View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      ))}
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(3) }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  brand: { fontSize: 18, fontWeight: '700', color: colors.primary },
  section: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11, color: colors.textHint, marginTop: 2 },
})
