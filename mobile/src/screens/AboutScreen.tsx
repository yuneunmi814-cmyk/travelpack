import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Card } from '../components/ui'
import { colors, space } from '../theme'
import { BUSINESS, BROKER_NOTICE, POLICIES } from '../legal'
import type { MyStackParams } from '../navigation/types'

type Props = NativeStackScreenProps<MyStackParams, 'About'>

export function AboutScreen(_props: Props) {
  const rows: [string, string][] = [
    ['상호', BUSINESS.name],
    ['대표자', BUSINESS.ceo],
    ['사업자등록번호', BUSINESS.regNo],
    ['통신판매업', BUSINESS.mailOrderNo || '간이과세자 — 신고 면제'],
    ['위치기반서비스 신고', BUSINESS.lbsReportNo || '신고 완료 (확인증 발급 예정)'],
    ['주소', BUSINESS.address],
    ['전화', BUSINESS.tel],
    ['이메일', BUSINESS.email],
  ]

  async function openPolicy(title: string, url: string | null) {
    if (!url) { Alert.alert(title, '정책 전문은 준비 중입니다. 곧 제공될 예정입니다.'); return }
    const ok = await Linking.canOpenURL(url)
    if (ok) Linking.openURL(url)
    else Alert.alert(title, '링크를 열 수 없습니다.')
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(5), gap: space(4) }}>
      <Card style={{ padding: space(4) }}>
        <Text style={styles.section}>사업자 정보</Text>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v}>{v || '(미설정)'}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ padding: space(4), backgroundColor: colors.bg2, borderColor: colors.line }}>
        <Text style={styles.section}>통신판매중개자 고지</Text>
        <Text style={{ color: colors.textSub, fontSize: 13, lineHeight: 19 }}>{BROKER_NOTICE}</Text>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Text style={[styles.section, { padding: space(4), paddingBottom: space(2) }]}>약관 및 정책</Text>
        {POLICIES.map((pol, i) => (
          <View key={pol.key}>
            {i > 0 && <View style={styles.div} />}
            <Text style={styles.policy} onPress={() => openPolicy(pol.title, pol.url)}>
              {pol.title} ›
            </Text>
          </View>
        ))}
      </Card>

      <Text style={styles.source}>관광 정보·사진 일부는 한국관광공사 TourAPI를 활용합니다.</Text>
      <Text style={styles.ver}>TravelPack v0.1.0</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: space(2) },
  row: { flexDirection: 'row', paddingVertical: 5 },
  k: { width: 116, color: colors.textSub, fontSize: 13 },
  v: { flex: 1, color: colors.text, fontSize: 13 },
  policy: { paddingHorizontal: space(4), paddingVertical: space(3), color: colors.text, fontSize: 14 },
  div: { height: 1, backgroundColor: colors.line, marginLeft: space(4) },
  source: { textAlign: 'center', color: colors.textHint, fontSize: 11, marginTop: space(3) },
  ver: { textAlign: 'center', color: colors.textHint, fontSize: 12, marginTop: space(1) },
})
