import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { colors, space } from '../theme'
import type { VideoCard } from '../api/types'

// 유튜브 여행영상(쇼츠) 가로 레일. 탭 시 인앱 브라우저(Custom Tab)로 유튜브 재생.
// (쇼츠는 유튜브가 외부 앱 IFrame 임베드 재생을 막아 오류 152가 나므로, 인앱 브라우저로 여는 게 안정적)
export function VideoRail({ videos, title }: { videos: VideoCard[]; title?: string }) {
  if (!videos || videos.length === 0) return null
  const open = (v: VideoCard) =>
    WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${v.youtubeId}`).catch(() => {})

  return (
    <View style={{ gap: space(3) }}>
      {title && <Text style={styles.title}>{title}</Text>}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={videos}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: space(3) }}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={styles.card}>
            <View>
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.bg2 }]} />
              )}
              <View style={styles.playBadge}><Text style={styles.playIcon}>▶</Text></View>
              {typeof item.durationSec === 'number' && item.durationSec > 0 && (
                <View style={styles.durBadge}><Text style={styles.durText}>{fmtDur(item.durationSec)}</Text></View>
              )}
            </View>
            <Text numberOfLines={2} style={styles.vtitle}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.meta}>
              {item.channel ?? ''}{item.viewCount ? ` · 조회 ${fmtViews(item.viewCount)}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </View>
  )
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function fmtViews(v: string | number): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return ''
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}천`
  return String(n)
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  card: { width: 160 },
  thumb: { width: 160, height: 96, borderRadius: 10, backgroundColor: colors.bg2 },
  playBadge: {
    position: 'absolute', top: 34, left: 66, width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 12, marginLeft: 2 },
  durBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  durText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  vtitle: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 6, lineHeight: 16 },
  meta: { fontSize: 11, color: colors.textHint, marginTop: 2 },
})
