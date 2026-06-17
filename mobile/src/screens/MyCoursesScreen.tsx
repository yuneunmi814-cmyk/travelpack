import { useEffect } from 'react'
import { FlatList, Image, Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { Button, Card, ImagePlaceholder, Loading, EmptyState, Badge } from '../components/ui'
import { colors, space } from '../theme'
import { durationLabel } from '../lib/format'
import type { MyStackParams } from '../navigation/types'
import type { MyCourse, ContentStatus, Paged } from '../api/types'

type Props = NativeStackScreenProps<MyStackParams, 'MyCourses'>

const STATUS: Record<ContentStatus, { label: string; tone: 'gray' | 'orange' | 'green' | 'navy' }> = {
  DRAFT: { label: '작성 중', tone: 'gray' },
  IN_REVIEW: { label: '검수 중', tone: 'orange' },
  PUBLISHED: { label: '판매 중', tone: 'green' },
  ARCHIVED: { label: '보관됨', tone: 'navy' },
}

export function MyCoursesScreen({ navigation }: Props) {
  const { data, loading, error, reload } = useResource<Paged<MyCourse>>('/me/courses?limit=30', { auth: true })

  // 에디터에서 돌아오면 목록 갱신
  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: space(4), paddingBottom: space(2) }}>
        <Button title="+ 새 여행팩 만들기" onPress={() => navigation.navigate('CourseEditor', {})} />
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState text={error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState text={'아직 만든 여행팩이 없어요.\n나만의 코스를 만들어 공개해 보세요!'} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: space(4), paddingTop: 0, gap: space(3) }}
          data={data.items}
          keyExtractor={(c) => c.id}
          renderItem={({ item: c }) => (
            <Pressable onPress={() => navigation.navigate('CourseEditor', { courseId: c.id })}>
              <Card style={{ flexDirection: 'row' }}>
                {c.cover ? <Image source={{ uri: c.cover }} style={{ width: 88, height: 88 }} /> : <ImagePlaceholder height={88} />}
                <View style={{ flex: 1, padding: space(3), gap: 4, justifyContent: 'center' }}>
                  <Badge label={STATUS[c.status].label} tone={STATUS[c.status].tone} />
                  <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={1}>{c.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textHint }}>
                    {c.region} · {durationLabel(c.durationDays)} · 명소 {c.spotCount}곳
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
