import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { Button, Card } from '../components/ui'
import { colors, space } from '../theme'
import type { MyStackParams } from '../navigation/types'

type Props = NativeStackScreenProps<MyStackParams, 'MyPage'>

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg2 }]}>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.textHint, fontSize: 18 }}>›</Text>
    </Pressable>
  )
}

export function MyScreen({ navigation }: Props) {
  const { user, isAuthed, logout } = useAuth()

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(5), gap: space(4) }}>
      {isAuthed && user ? (
        <>
          <Card style={{ padding: space(5), gap: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{user.nickname}</Text>
            <Text style={{ color: colors.textHint, fontSize: 13 }}>{user.email ?? '소셜 계정'}</Text>
            {user.interests.length > 0 && (
              <Text style={{ color: colors.textSub, fontSize: 12, marginTop: 4 }}>관심: {user.interests.map((i) => i.name).join(', ')}</Text>
            )}
          </Card>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Row label="🧳 내 여행팩 (만들기·판매)" onPress={() => navigation.navigate('MyCourses')} />
            <View style={styles.div} />
            <Row label="🛒 구매한 여행팩" onPress={() => navigation.navigate('MyPurchases')} />
            <View style={styles.div} />
            <Row label="⭐ 관심 테마 설정" onPress={() => navigation.navigate('Interests')} />
          </Card>
          <Button title="로그아웃" kind="ghost" onPress={logout} />
        </>
      ) : (
        <Card style={{ padding: space(5), gap: space(3), alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>로그인하고 더 많은 기능을</Text>
          <Text style={{ color: colors.textSub, textAlign: 'center' }}>저장·여행 시작·리뷰는 로그인이 필요해요.</Text>
          <Button title="로그인 / 가입" onPress={() => navigation.navigate('Login')} style={{ alignSelf: 'stretch' }} />
        </Card>
      )}
      <Text style={styles.ver}>TravelPack v0.1.0</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  ver: { textAlign: 'center', color: colors.textHint, fontSize: 12, marginTop: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingVertical: space(4) },
  div: { height: 1, backgroundColor: colors.line, marginLeft: space(4) },
})
