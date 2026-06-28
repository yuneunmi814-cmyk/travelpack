import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { api, ApiError } from '../api/client'
import { Card, Loading, EmptyState, Pill } from '../components/ui'
import { colors, radius, space } from '../theme'
import { durationLabel } from '../lib/format'
import type { ExploreStackParams } from '../navigation/types'
import type { SearchResult } from '../api/types'

type Props = NativeStackScreenProps<ExploreStackParams, 'Search'>

export function SearchScreen({ navigation }: Props) {
  const [q, setQ] = useState('')
  const [data, setData] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 디바운스 검색(2자 이상)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setData(null); setError(null); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api<SearchResult>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => { if (alive) { setData({ courses: r?.courses ?? [], spots: r?.spots ?? [], regions: r?.regions ?? [] }); setError(null) } })
        .catch((e) => { if (alive) setError(e instanceof ApiError ? e.message : '검색 실패') })
        .finally(() => { if (alive) setLoading(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  const empty = data && data.courses.length === 0 && data.spots.length === 0 && data.regions.length === 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: space(4), paddingBottom: space(2) }}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="코스·관광지·지역 검색"
          placeholderTextColor={colors.textHint}
          autoFocus
          returnKeyType="search"
        />
      </View>

      {q.trim().length < 2 ? (
        <EmptyState text="두 글자 이상 입력해 주세요" />
      ) : loading && !data ? (
        <Loading />
      ) : error ? (
        <EmptyState text={error} />
      ) : empty ? (
        <EmptyState text={`'${q.trim()}' 검색 결과가 없어요`} />
      ) : !data ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space(4), paddingTop: 0, gap: space(4) }}>
          {data!.regions.length > 0 && (
            <Section title="지역">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {data!.regions.map((r) => (
                  <Pressable key={r.id} onPress={() => navigation.navigate('CourseList', { regionId: r.id, regionName: r.name })}>
                    <Pill label={r.name} />
                  </Pressable>
                ))}
              </View>
            </Section>
          )}

          {data!.courses.length > 0 && (
            <Section title={`코스 ${data!.courses.length}`}>
              {data!.courses.map((c) => (
                <Pressable key={c.id} onPress={() => navigation.navigate('CourseDetail', { courseId: c.id })}>
                  <Card style={{ padding: space(3), marginBottom: space(2) }}>
                    <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>{c.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textHint, marginTop: 2 }}>
                      {c.region} · {durationLabel(c.durationDays)} · 명소 {c.spotCount}곳
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </Section>
          )}

          {data!.spots.length > 0 && (
            <Section title={`관광지 ${data!.spots.length}`}>
              {data!.spots.map((s) => (
                <Pressable key={s.id} onPress={() => navigation.navigate('SpotDetail', { spotId: s.id })}>
                  <Card style={{ padding: space(3), marginBottom: space(2) }}>
                    <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textHint, marginTop: 2 }}>
                      {s.region} · {s.category}{s.address ? ` · ${s.address}` : ''}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSub }}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 11, color: colors.text, backgroundColor: colors.white, fontSize: 15 },
})
