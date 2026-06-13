import { FlatList, Image, Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { Card, ImagePlaceholder, Loading, EmptyState, Badge } from '../components/ui'
import { colors, space } from '../theme'
import { priceLabel, durationLabel } from '../lib/format'
import type { MyStackParams } from '../navigation/types'
import type { Purchase, Paged } from '../api/types'

type Props = NativeStackScreenProps<MyStackParams, 'MyPurchases'>

export function MyPurchasesScreen({ navigation }: Props) {
  const { data, loading, error } = useResource<Paged<Purchase>>('/me/purchases?limit=30', { auth: true })

  function openCourse(courseId: string) {
    const parent = navigation.getParent() as { navigate: (name: string, params: unknown) => void } | undefined
    parent?.navigate('ExploreTab', { screen: 'CourseDetail', params: { courseId } })
  }

  if (loading) return <Loading />
  if (error) return <EmptyState text={error} />
  if (!data || data.items.length === 0) return <EmptyState text="구매한 여행팩이 없어요" />

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), gap: space(3) }}
      data={data.items}
      keyExtractor={(p) => p.purchaseId}
      renderItem={({ item: p }) => (
        <Pressable onPress={() => openCourse(p.course.id)}>
          <Card style={{ flexDirection: 'row' }}>
            {p.course.cover ? <Image source={{ uri: p.course.cover }} style={{ width: 96, height: 96 }} /> : <ImagePlaceholder height={96} />}
            <View style={{ flex: 1, padding: space(3), gap: 4, justifyContent: 'center' }}>
              <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={1}>{p.course.title}</Text>
              <Text style={{ fontSize: 12, color: colors.textHint }}>
                {p.course.region} · {durationLabel(p.course.durationDays)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Badge label="구매 완료" tone="green" />
                <Text style={{ fontSize: 12, color: colors.textSub }}>{priceLabel(p.price)}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      )}
    />
  )
}
