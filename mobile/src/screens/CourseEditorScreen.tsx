import { useEffect, useMemo, useState } from 'react'
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useResource } from '../api/useResource'
import { api, ApiError } from '../api/client'
import { Button, Card, ImagePlaceholder, Loading, EmptyState, Pill } from '../components/ui'
import { colors, radius, space } from '../theme'
import { priceLabel } from '../lib/format'
import type { MyStackParams } from '../navigation/types'
import type { ContentStatus, MyCourseDetail, Paged, Region, SpotPick, Theme } from '../api/types'

type Props = NativeStackScreenProps<MyStackParams, 'CourseEditor'>

interface EditorItem {
  key: string
  dayNo: number
  spot: { id: string; name: string; category: string; thumbnail: string | null }
  stayMinutes: number | null
}

let keySeq = 0
const newKey = () => `it_${keySeq++}`

export function CourseEditorScreen({ navigation, route }: Props) {
  const [courseId, setCourseId] = useState<string | undefined>(route.params?.courseId)
  const regionsRes = useResource<{ regions: Region[] }>('/regions')
  const themesRes = useResource<{ themes: Theme[] }>('/themes')
  const existing = useResource<MyCourseDetail>(courseId ? `/me/courses/${courseId}` : null, { auth: true, deps: [courseId] })

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [regionId, setRegionId] = useState<string | null>(null)
  const [duration, setDuration] = useState(1)
  const [price, setPrice] = useState('0')
  const [themeIds, setThemeIds] = useState<string[]>([])
  const [items, setItems] = useState<EditorItem[]>([])
  const [status, setStatus] = useState<ContentStatus | 'NEW'>('NEW')
  const [saving, setSaving] = useState(false)

  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [q, setQ] = useState('')

  // 편집 모드: 기존 코스 프리필
  useEffect(() => {
    const d = existing.data
    if (!d) return
    setTitle(d.title)
    setSummary(d.summary ?? '')
    setRegionId(d.region.id)
    setDuration(d.durationDays)
    setPrice(String(d.price))
    setThemeIds(d.themes.map((t) => t.id))
    setStatus(d.status)
    setItems(
      d.days.flatMap((day) =>
        day.items.map((it) => ({ key: newKey(), dayNo: day.dayNo, spot: { id: it.spot.id, name: it.spot.name, category: it.spot.category, thumbnail: it.spot.thumbnail }, stayMinutes: it.stayMinutes })),
      ),
    )
  }, [existing.data])

  const readOnly = status !== 'NEW' && status !== 'DRAFT'
  const maxItemDay = items.reduce((m, it) => Math.max(m, it.dayNo), 1)

  const spotPath = pickerDay != null && regionId ? `/spots?regionId=${regionId}&limit=30${q ? `&q=${encodeURIComponent(q)}` : ''}` : null
  const spotsRes = useResource<Paged<SpotPick>>(spotPath, { deps: [pickerDay, regionId, q] })

  function toggleTheme(id: string) {
    setThemeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 10 ? prev : [...prev, id]))
  }

  function addSpot(day: number, s: SpotPick) {
    setItems((prev) => [...prev, { key: newKey(), dayNo: day, spot: { id: s.id, name: s.name, category: s.category, thumbnail: s.thumbnail }, stayMinutes: null }])
    setPickerDay(null)
    setQ('')
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  function moveItem(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const it = prev.find((x) => x.key === key)
      if (!it) return prev
      const sameDay = prev.filter((x) => x.dayNo === it.dayNo)
      const idx = sameDay.indexOf(it)
      const swapWith = sameDay[idx + dir]
      if (!swapWith) return prev
      const next = [...prev]
      const a = next.indexOf(it)
      const b = next.indexOf(swapWith)
      ;[next[a], next[b]] = [next[b]!, next[a]!]
      return next
    })
  }

  function buildPayload() {
    // 일자별 순서를 1부터 재계산
    const perDayCount: Record<number, number> = {}
    const payloadItems = items.map((it) => {
      perDayCount[it.dayNo] = (perDayCount[it.dayNo] ?? 0) + 1
      return { dayNo: it.dayNo, sortOrder: perDayCount[it.dayNo]!, spotId: it.spot.id, stayMinutes: it.stayMinutes ?? undefined }
    })
    return {
      title: title.trim(),
      regionId,
      summary: summary.trim() || undefined,
      durationDays: duration,
      price: Number(price) || 0,
      themeIds,
      items: payloadItems,
    }
  }

  async function save(): Promise<string | null> {
    if (title.trim().length < 2) { Alert.alert('제목을 입력하세요', '2자 이상 입력해 주세요.'); return null }
    if (!regionId) { Alert.alert('지역을 선택하세요'); return null }
    setSaving(true)
    try {
      const body = buildPayload()
      if (courseId) {
        await api(`/me/courses/${courseId}`, { method: 'PUT', auth: true, body })
        return courseId
      }
      const created = await api<{ id: string }>('/me/courses', { method: 'POST', auth: true, body })
      setCourseId(created.id)
      setStatus('DRAFT')
      navigation.setParams({ courseId: created.id })
      return created.id
    } catch (e) {
      Alert.alert('저장 실패', e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function onSavePress() {
    const id = await save()
    if (id) Alert.alert('저장됐어요', '임시저장되었습니다. 검수 요청하면 관리자 승인 후 마켓에 공개돼요.')
  }

  async function onSubmitPress() {
    if (items.length === 0) { Alert.alert('스팟을 추가하세요', '최소 1곳 이상 담아야 검수 요청할 수 있어요.'); return }
    const id = await save()
    if (!id) return
    try {
      await api(`/me/courses/${id}/submit`, { method: 'POST', auth: true })
      setStatus('IN_REVIEW')
      Alert.alert('검수 요청 완료', '관리자 승인 후 마켓플레이스에 공개돼요.')
    } catch (e) {
      Alert.alert('검수 요청 실패', e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요')
    }
  }

  async function onWithdrawPress() {
    if (!courseId) return
    try {
      await api(`/me/courses/${courseId}/withdraw`, { method: 'POST', auth: true })
      setStatus('DRAFT')
      Alert.alert('회수했어요', '다시 수정할 수 있어요.')
    } catch (e) {
      Alert.alert('회수 실패', e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요')
    }
  }

  function onDeletePress() {
    if (!courseId) { navigation.goBack(); return }
    Alert.alert('삭제할까요?', '작성 중인 여행팩을 삭제합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/me/courses/${courseId}`, { method: 'DELETE', auth: true })
            navigation.goBack()
          } catch (e) {
            Alert.alert('삭제 실패', e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요')
          }
        },
      },
    ])
  }

  if (courseId && existing.loading) return <Loading />

  const days = Array.from({ length: duration }, (_, i) => i + 1)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space(5), gap: space(4), paddingBottom: space(8) }}>
        {readOnly && (
          <Card style={{ padding: space(4), backgroundColor: colors.bg2, borderColor: colors.line }}>
            <Text style={{ color: colors.textSub, fontSize: 13 }}>
              {status === 'IN_REVIEW' ? '검수 중인 코스예요. 회수하면 다시 수정할 수 있어요.' : status === 'PUBLISHED' ? '판매 중인 코스예요. 수정하려면 운영팀에 문의하세요.' : '보관된 코스예요.'}
            </Text>
          </Card>
        )}

        <Field label="제목">
          <TextInput style={styles.input} value={title} onChangeText={setTitle} editable={!readOnly} placeholder="예) 현지인의 제주 동부 1박2일" placeholderTextColor={colors.textHint} />
        </Field>

        <Field label="한 줄 소개">
          <TextInput style={[styles.input, { height: 64 }]} value={summary} onChangeText={setSummary} editable={!readOnly} multiline placeholder="코스의 매력을 짧게 소개해 주세요" placeholderTextColor={colors.textHint} />
        </Field>

        <Field label="지역">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {regionsRes.data?.regions.map((r) => (
              <Pressable key={r.id} disabled={readOnly} onPress={() => setRegionId(r.id)}>
                <Pill label={r.name} active={regionId === r.id} />
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={{ flexDirection: 'row', gap: space(4) }}>
          <Field label="기간(일)" style={{ flex: 1 }}>
            <View style={styles.stepper}>
              <Pressable disabled={readOnly || duration <= Math.max(1, maxItemDay)} onPress={() => setDuration((d) => Math.max(1, d - 1))} style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={{ fontWeight: '700', color: colors.text, minWidth: 24, textAlign: 'center' }}>{duration}</Text>
              <Pressable disabled={readOnly || duration >= 10} onPress={() => setDuration((d) => Math.min(10, d + 1))} style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>＋</Text>
              </Pressable>
            </View>
          </Field>
          <Field label="가격(원, 0=무료)" style={{ flex: 1 }}>
            <TextInput style={styles.input} value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} editable={!readOnly} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textHint} />
            <Text style={{ color: colors.textHint, fontSize: 12, marginTop: 4 }}>{priceLabel(Number(price) || 0)}</Text>
          </Field>
        </View>

        <Field label="테마 (최대 10)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {themesRes.data?.themes.map((t) => (
              <Pressable key={t.id} disabled={readOnly} onPress={() => toggleTheme(t.id)}>
                <Pill label={t.name} active={themeIds.includes(t.id)} />
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={{ gap: space(2) }}>
          <Text style={styles.fieldLabel}>일정 ({items.length}곳)</Text>
          {days.map((dayNo) => {
            const dayItems = items.filter((it) => it.dayNo === dayNo)
            return (
              <Card key={dayNo} style={{ padding: space(3), gap: 6 }}>
                <Text style={{ fontWeight: '700', color: colors.navy }}>Day {dayNo}</Text>
                {dayItems.length === 0 && <Text style={{ color: colors.textHint, fontSize: 12 }}>아직 담은 스팟이 없어요</Text>}
                {dayItems.map((it, idx) => (
                  <View key={it.key} style={styles.itemRow}>
                    <View style={styles.itemNo}><Text style={{ color: colors.white, fontSize: 11, fontWeight: '700' }}>{idx + 1}</Text></View>
                    <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }} numberOfLines={1}>{it.spot.name}</Text>
                    {!readOnly && (
                      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <Pressable onPress={() => moveItem(it.key, -1)}><Text style={styles.iconBtn}>▲</Text></Pressable>
                        <Pressable onPress={() => moveItem(it.key, 1)}><Text style={styles.iconBtn}>▼</Text></Pressable>
                        <Pressable onPress={() => removeItem(it.key)}><Text style={[styles.iconBtn, { color: colors.error }]}>✕</Text></Pressable>
                      </View>
                    )}
                  </View>
                ))}
                {!readOnly && (
                  <Pressable
                    onPress={() => (regionId ? setPickerDay(dayNo) : Alert.alert('지역을 먼저 선택하세요'))}
                    style={styles.addSpot}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>+ 스팟 추가</Text>
                  </Pressable>
                )}
              </Card>
            )
          })}
        </View>
      </ScrollView>

      {/* 하단 액션 */}
      <View style={styles.actions}>
        {!readOnly ? (
          <>
            <Button title={saving ? '저장 중…' : '임시저장'} kind="ghost" onPress={onSavePress} disabled={saving} style={{ flex: 1 }} />
            <Button title="검수 요청" kind="primary" onPress={onSubmitPress} disabled={saving} style={{ flex: 1 }} />
          </>
        ) : status === 'IN_REVIEW' ? (
          <Button title="검수 회수" kind="ghost" onPress={onWithdrawPress} style={{ flex: 1 }} />
        ) : (
          <Button title="닫기" kind="ghost" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        )}
        {(status === 'NEW' || status === 'DRAFT') && (
          <Pressable onPress={onDeletePress} style={styles.delBtn}><Text style={{ color: colors.error, fontWeight: '600' }}>삭제</Text></Pressable>
        )}
      </View>

      {/* 스팟 선택 모달 */}
      <Modal visible={pickerDay != null} animationType="slide" onRequestClose={() => setPickerDay(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: space(12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: space(4) }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={q} onChangeText={setQ} placeholder="스팟 이름 검색" placeholderTextColor={colors.textHint} />
            <Pressable onPress={() => { setPickerDay(null); setQ('') }}><Text style={{ color: colors.textSub, fontWeight: '600' }}>닫기</Text></Pressable>
          </View>
          {spotsRes.loading ? (
            <Loading />
          ) : !spotsRes.data || spotsRes.data.items.length === 0 ? (
            <EmptyState text="스팟이 없어요" />
          ) : (
            <FlatList
              contentContainerStyle={{ padding: space(4), paddingTop: 0, gap: space(2) }}
              data={spotsRes.data.items}
              keyExtractor={(s) => s.id}
              renderItem={({ item: s }) => (
                <Pressable onPress={() => pickerDay != null && addSpot(pickerDay, s)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {s.thumbnail ? <Image source={{ uri: s.thumbnail }} style={{ width: 56, height: 56 }} /> : <ImagePlaceholder height={56} />}
                    <View style={{ flex: 1, padding: space(3) }}>
                      <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>{s.name}</Text>
                      <Text style={{ color: colors.textHint, fontSize: 12 }}>{s.category}</Text>
                    </View>
                    <Text style={{ color: colors.primary, fontWeight: '700', paddingRight: space(4) }}>담기</Text>
                  </Card>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(3), borderWidth: 1, borderColor: colors.line, borderRadius: radius.button, paddingVertical: 6, justifyContent: 'center' },
  stepBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  itemNo: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { fontSize: 14, color: colors.textSub },
  addSpot: { borderWidth: 1, borderColor: colors.primaryWeak, backgroundColor: colors.primaryWeak, borderRadius: radius.button, paddingVertical: 8, alignItems: 'center', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  delBtn: { paddingHorizontal: space(3), height: 46, alignItems: 'center', justifyContent: 'center' },
})
