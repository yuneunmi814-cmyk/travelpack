import { ScrollView, Text, View, Pressable, StyleSheet, Image } from 'react-native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { useResource } from '../api/useResource'
import { Card, ImagePlaceholder, Loading, EmptyState, Pill, Badge } from '../components/ui'
import { VideoRail } from '../components/VideoRail'
import { colors, space } from '../theme'
import type { TabParams } from '../navigation/types'
import type { CourseCard, HomeFeed, MarketCard, Paged, Region } from '../api/types'

type Props = BottomTabScreenProps<TabParams, 'HomeTab'>

export function HomeScreen({ navigation }: Props) {
  const { data, loading, error, reload } = useResource<HomeFeed>('/home')
  // 커뮤니티 인기 여행팩(사용자 공유) — 비어 있으면 섹션 숨김
  const community = useResource<Paged<MarketCard>>('/marketplace/courses?sort=popular&limit=10')

  function openCourse(courseId: string) {
    navigation.navigate('ExploreTab', { screen: 'CourseDetail', params: { courseId } })
  }
  function openRegion(r: { id: string; name: string }) {
    navigation.navigate('ExploreTab', { screen: 'CourseList', params: { regionId: r.id, regionName: r.name } })
  }
  function openMarketplace() {
    navigation.navigate('ExploreTab', { screen: 'Marketplace' })
  }
  function openSearch() {
    navigation.navigate('ExploreTab', { screen: 'Search' })
  }

  if (loading) return <Loading />
  if (error || !data) return <EmptyState text={error ? '불러오지 못했어요. 서버가 깨어나는 중일 수 있어요.' : '불러오기 실패'} onRetry={reload} />

  const communityPacks = community.data?.items ?? []

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(5), gap: space(5) }}>
      <Text style={styles.brand}>TravelPack</Text>

      <Pressable onPress={openSearch} style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchText}>지역·코스·관광지 검색</Text>
      </Pressable>

      {data.banners[0] && (
        <Card style={{ backgroundColor: colors.navy }}>
          <View style={{ padding: space(5) }}>
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>{data.banners[0].title}</Text>
            <Text style={{ color: '#B9C4D6', fontSize: 12, marginTop: 4 }}>에디터가 다녀온 코스 모음</Text>
          </View>
        </Card>
      )}

      {/* 메인 히어로: 검증된 큐레이션 코스 */}
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

      {/* 유튜브 여행 쇼츠 피드 */}
      {data.shortsFeed?.length > 0 && (
        <Section title="🎬 여행 쇼츠">
          <VideoRail videos={data.shortsFeed} />
        </Section>
      )}

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

      {/* 유튜브 화제도 기반 '요즘 뜨는 여행지' */}
      {data.trendingRegions?.length > 0 && (
        <Section title="🔥 요즘 뜨는 여행지">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
            {data.trendingRegions.map((r) => (
              <Pressable key={r.id} onPress={() => openRegion(r)} style={{ width: 120 }}>
                <Card>
                  {r.thumbnail ? <Image source={{ uri: r.thumbnail }} style={{ height: 80, width: '100%' }} /> : <ImagePlaceholder height={80} />}
                  <View style={{ padding: space(3), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.cardTitle}>{r.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>🔥{r.buzzScore}</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

      {/* 커뮤니티: 사용자가 공유한 여행팩(자랑) */}
      {communityPacks.length > 0 && (
        <Section title="커뮤니티 인기 여행팩" action={{ label: '더보기', onPress: openMarketplace }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
            {communityPacks.map((c) => (
              <Pressable key={c.id} onPress={() => openCourse(c.id)} style={{ width: 180 }}>
                <Card>
                  {c.cover ? <Image source={{ uri: c.cover }} style={{ height: 96, width: '100%' }} /> : <ImagePlaceholder height={96} />}
                  <View style={{ padding: space(3), gap: 3 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Badge label={`by ${c.author?.nickname ?? '여행자'}`} tone="navy" />
                      {c.saveCount > 0 && <Text style={styles.meta}>♡ {c.saveCount.toLocaleString()}</Text>}
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

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

function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.section}>{title}</Text>
        {action && <Text style={styles.more} onPress={action.onPress}>{action.label} ›</Text>}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  brand: { fontSize: 18, fontWeight: '700', color: colors.primary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  searchIcon: { fontSize: 14 },
  searchText: { color: colors.textHint, fontSize: 14 },
  section: { fontSize: 16, fontWeight: '600', color: colors.text },
  more: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11, color: colors.textHint, marginTop: 2 },
})
