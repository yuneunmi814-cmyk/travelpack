import { useState } from 'react'
import { FlatList, Image, Pressable, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { Card, ImagePlaceholder, Loading, EmptyState, Pill, Badge } from '../components/ui'
import { colors, space } from '../theme'
import { priceLabel, durationLabel } from '../lib/format'
import type { ExploreStackParams } from '../navigation/types'
import type { MarketCard, Paged } from '../api/types'

type Props = NativeStackScreenProps<ExploreStackParams, 'Marketplace'>

const SORTS = [
  { key: 'popular', label: '인기순' },
  { key: 'latest', label: '최신순' },
  { key: 'free', label: '무료' },
] as const

export function MarketplaceScreen({ navigation }: Props) {
  const [sort, setSort] = useState<'popular' | 'latest' | 'free'>('popular')
  const { data, loading, error } = useResource<Paged<MarketCard>>(`/marketplace/courses?sort=${sort}&limit=20`, { deps: [sort] })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: space(4), paddingBottom: space(2) }}>
        {SORTS.map((s) => (
          <Pressable key={s.key} onPress={() => setSort(s.key)}>
            <Pill label={s.label} active={sort === s.key} />
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState text={error} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState text="아직 등록된 여행팩이 없어요" />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: space(4), paddingTop: 0, gap: space(3) }}
          data={data.items}
          keyExtractor={(c) => c.id}
          renderItem={({ item: c }) => (
            <Pressable onPress={() => navigation.navigate('CourseDetail', { courseId: c.id })}>
              <Card>
                {c.cover ? <Image source={{ uri: c.cover }} style={{ height: 130, width: '100%' }} /> : <ImagePlaceholder height={120} />}
                <View style={{ padding: space(3), gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text, flex: 1 }}>{c.title}</Text>
                    <Text style={{ fontWeight: '800', color: c.price > 0 ? colors.primary : colors.success }}>{priceLabel(c.price)}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textHint }}>
                    {c.region} · {durationLabel(c.durationDays)} · 명소 {c.spotCount}곳
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <Badge label={`by ${c.author?.nickname ?? '크리에이터'}`} tone="navy" />
                    {c.salesCount > 0 && <Text style={{ fontSize: 11, color: colors.textHint }}>· {c.salesCount}명 구매</Text>}
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
