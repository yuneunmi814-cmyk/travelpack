import { useState } from 'react'
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { colors, space } from '../theme'
import type { VideoCard } from '../api/types'

// 유튜브 여행영상(쇼츠) 가로 레일 — 썸네일 탭 시 인앱 WebView 플레이어(공식 임베드).
// react-native-webview만 사용(추가 네이티브 의존성 없음).
export function VideoRail({ videos, title }: { videos: VideoCard[]; title?: string }) {
  const [playing, setPlaying] = useState<VideoCard | null>(null)
  if (!videos || videos.length === 0) return null

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
          <Pressable onPress={() => setPlaying(item)} style={styles.card}>
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

      <Modal visible={!!playing} animationType="slide" transparent onRequestClose={() => setPlaying(null)}>
        <View style={styles.modalBg}>
          <Pressable style={{ flex: 1 }} onPress={() => setPlaying(null)} />
          <View style={styles.playerWrap}>
            <View style={styles.playerBar}>
              <Text numberOfLines={1} style={styles.playerTitle}>{playing?.title}</Text>
              <Pressable hitSlop={10} onPress={() => setPlaying(null)}><Text style={styles.close}>✕</Text></Pressable>
            </View>
            {playing && (
              <WebView
                source={{ uri: `https://www.youtube.com/embed/${playing.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1` }}
                style={{ flex: 1, backgroundColor: '#000' }}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
              />
            )}
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setPlaying(null)} />
        </View>
      </Modal>
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
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  playerWrap: { height: 320, backgroundColor: '#000' },
  playerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingVertical: 10, gap: 12 },
  playerTitle: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  close: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
