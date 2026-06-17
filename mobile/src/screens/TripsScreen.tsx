import { useCallback } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, Loading, EmptyState, Badge } from '../components/ui'
import { colors, space } from '../theme'
import type { TripsStackParams } from '../navigation/types'
import type { Paged, Trip } from '../api/types'

type Props = NativeStackScreenProps<TripsStackParams, 'MyTrips'>

const STATUS_LABEL: Record<string, string> = { UPCOMING: '예정', ONGOING: '진행 중', COMPLETED: '완료', CANCELED: '취소' }

export function TripsScreen({ navigation }: Props) {
  const { isAuthed } = useAuth()
  const { data, loading, error, reload } = useResource<Paged<Trip>>(isAuthed ? '/trips/me?limit=20' : null, { auth: true })

  useFocusEffect(useCallback(() => { if (isAuthed) reload() }, [isAuthed, reload]))

  // 다른 탭(홈)으로 이동 — 코스를 골라 "이 코스로 여행 시작"하면 내 여행에 추가된다
  const goExplore = () => (navigation.getParent() as { navigate: (n: string) => void } | undefined)?.navigate('HomeTab')

  if (!isAuthed) return <EmptyState text="로그인하면 내 여행을 볼 수 있어요" />
  if (loading) return <Loading />
  if (error || !data) return <EmptyState text={error ?? '불러오기 실패'} />
  if (data.items.length === 0)
    return (
      <EmptyState
        text={'아직 시작한 여행이 없어요.\n마음에 드는 코스로 여행을 시작해 보세요!'}
        action={{ label: '추천 코스 둘러보기', onPress: goExplore }}
      />
    )

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(5), gap: space(3) }}
      data={data.items}
      keyExtractor={(t) => t.id}
      renderItem={({ item: t }) => (
        <Card style={{ padding: space(4), gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', fontSize: 14, color: colors.text }}>{t.course.title}</Text>
            <Badge label={STATUS_LABEL[t.status] ?? t.status} tone={t.status === 'ONGOING' ? 'orange' : t.status === 'COMPLETED' ? 'green' : 'gray'} />
          </View>
          <Text style={{ color: colors.textHint, fontSize: 12 }}>{t.startDate} ~ {t.endDate}</Text>
          <Text style={{ color: colors.textHint, fontSize: 12 }}>{t.progress.done}/{t.progress.total} 체크인</Text>
          {t.status !== 'COMPLETED' && t.status !== 'CANCELED' && (
            <Button title="가이드 모드 이어하기" onPress={() => navigation.navigate('GuideMode', { tripId: t.id })} />
          )}
        </Card>
      )}
    />
  )
}
