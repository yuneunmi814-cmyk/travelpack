import { env } from '../../config/env.js'
import { Errors } from '../../lib/errors.js'

// YouTube Data API v3 — 여행영상(짧은 영상/쇼츠) 검색·상세.
//   search.list  : 100 units/call (쿼터 10,000/일)
//   videos.list  : 1 unit/call
const SEARCH = 'https://www.googleapis.com/youtube/v3/search'
const VIDEOS = 'https://www.googleapis.com/youtube/v3/videos'

export interface YtVideo {
  youtubeId: string
  title: string
  channelTitle: string | null
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number
  durationSec: number | null
}

interface SearchResp { items?: { id?: { videoId?: string }; snippet?: { channelTitle?: string } }[] }
interface VideosResp {
  items?: {
    id: string
    snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }
    statistics?: { viewCount?: string }
    contentDetails?: { duration?: string }
  }[]
}

// 테스트 주입 지점 — 실제 HTTP 대신 가짜 응답을 넣는다.
export type Transport = (url: string) => Promise<unknown>
let transport: Transport = async (url) => {
  const res = await fetch(url)
  const body = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[]; message?: string } } | null
  if (!res.ok || body?.error) {
    const reason = body?.error?.errors?.[0]?.reason ?? String(res.status)
    throw Errors.conflict('YOUTUBE_ERROR', `YouTube API 오류 (${reason}) — 키/쿼터 확인`)
  }
  return body
}
export function setYoutubeTransportForTest(fn: Transport): void { transport = fn }

function apiKey(): string {
  if (!env.YOUTUBE_API_KEY) throw Errors.notConfigured('YouTube API 키(YOUTUBE_API_KEY)')
  return env.YOUTUBE_API_KEY
}

// ISO8601 'PT1M30S' → 90초
export function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso)
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

// 음원 자동생성 채널('OOO - Topic')은 여행영상이 아니므로 제외
const isMusicChannel = (ch: string | null): boolean => Boolean(ch && / - Topic$/.test(ch))

async function searchIds(query: string, max: number): Promise<string[]> {
  const sp = new URLSearchParams({
    key: apiKey(), part: 'snippet', q: query, type: 'video', videoDuration: 'short',
    videoEmbeddable: 'true', order: 'relevance', regionCode: 'KR', relevanceLanguage: 'ko',
    safeSearch: 'moderate', maxResults: String(Math.min(max, 25)),
  })
  const body = (await transport(`${SEARCH}?${sp.toString()}`)) as SearchResp
  return (body.items ?? []).map((it) => it.id?.videoId).filter((v): v is string => Boolean(v))
}

async function fetchDetails(ids: string[]): Promise<YtVideo[]> {
  if (ids.length === 0) return []
  const sp = new URLSearchParams({ key: apiKey(), part: 'snippet,statistics,contentDetails', id: ids.join(',') })
  const body = (await transport(`${VIDEOS}?${sp.toString()}`)) as VideosResp
  return (body.items ?? []).map((it) => {
    const th = it.snippet?.thumbnails ?? {}
    return {
      youtubeId: it.id,
      title: it.snippet?.title ?? '',
      channelTitle: it.snippet?.channelTitle ?? null,
      thumbnailUrl: th.high?.url ?? th.medium?.url ?? th.default?.url ?? null,
      publishedAt: it.snippet?.publishedAt ?? null,
      viewCount: Number(it.statistics?.viewCount ?? 0),
      durationSec: parseDuration(it.contentDetails?.duration),
    }
  })
}

// 여행영상 수집: 검색 → 상세 → 음원채널 제외 → 조회수 내림차순 상위 N
export async function fetchTravelVideos(query: string, want = 8): Promise<YtVideo[]> {
  const ids = await searchIds(query, Math.max(want * 2, 12))
  const details = await fetchDetails(ids)
  return details
    .filter((v) => !isMusicChannel(v.channelTitle) && v.viewCount > 0)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, want)
}
