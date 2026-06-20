import type { PrismaClient } from '@prisma/client'
import { env } from '../../config/env.js'
import { Errors } from '../../lib/errors.js'

// 영상(URL) → 캡션 → Gemini 장소추출 → 좌표(카카오 로컬→TourAPI) → DRAFT 코스 자동생성.
// 결정피로 ↓ 모토: 관광지 + 맛집 + 카페를 순서대로 담는다.

export interface ExtractedPlace { name: string; type: string }
export interface ResolvedSpot { name: string; category: string; lat: number; lng: number; image: string | null }

// ── 1) URL → 캡션 텍스트 ───────────────────────────────────────
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m?.[1] ?? null
}

export async function fetchCaption(url: string, provided?: string): Promise<{ title: string; text: string }> {
  const yid = youtubeId(url)
  if (yid) {
    if (!env.YOUTUBE_API_KEY) throw Errors.notConfigured('YouTube API 키')
    const sp = new URLSearchParams({ part: 'snippet', id: yid, key: env.YOUTUBE_API_KEY })
    const body = (await (await fetch(`https://www.googleapis.com/youtube/v3/videos?${sp}`)).json()) as { items?: { snippet?: { title?: string; description?: string } }[] }
    const sn = body.items?.[0]?.snippet
    if (!sn) throw Errors.badRequest('VIDEO_NOT_FOUND', '영상을 찾을 수 없어요')
    return { title: sn.title ?? '', text: `${sn.title ?? ''}\n${sn.description ?? ''}` }
  }
  if (/tiktok\.com/.test(url)) {
    const body = (await (await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)).json().catch(() => null)) as { title?: string } | null
    if (body?.title) return { title: body.title, text: body.title }
    if (provided) return { title: '틱톡 영상', text: provided }
    throw Errors.badRequest('CAPTION_NEEDED', '틱톡 설명을 못 읽었어요. 캡션을 함께 붙여넣어 주세요')
  }
  // 인스타 등 — 캡션 직접 입력 필요
  if (provided) return { title: '영상 코스', text: provided }
  throw Errors.badRequest('CAPTION_NEEDED', '이 영상은 설명을 자동으로 못 읽어요. 캡션 텍스트를 함께 붙여넣어 주세요')
}

// ── 2) 캡션 → Gemini 장소 추출 ─────────────────────────────────
export async function extractPlaces(caption: string): Promise<{ region: string; title: string; places: ExtractedPlace[] }> {
  if (!env.GEMINI_API_KEY) throw Errors.notConfigured('Gemini API 키')
  const prompt =
    '너는 여행 코스 큐레이터야. 아래 여행 영상 캡션에서 실제로 방문하는 장소만 순서대로 추출해. ' +
    "관광지·맛집·카페·시장·해변 등 '갈 수 있는 곳'은 포함하고, 메뉴이름·일반단어(코스/일정/관람/추천/Day)·해시태그·교통수단·가격·주소는 제외해. " +
    '각 장소는 검색 가능한 고유명사로. region은 한국 도시/지역명 하나(예: 제주, 여수, 경주). title은 12자 이내 코스 제목. ' +
    'JSON으로만: {"region":"지역","title":"코스제목","places":[{"name":"장소명","type":"관광지|맛집|카페|기타"}]}\n\n캡션:\n' +
    caption.slice(0, 3000)
  const req = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
  })
  const body = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } } | null
  if (!res.ok || body?.error) throw Errors.conflict('GEMINI_ERROR', `Gemini 오류 — ${body?.error?.message ?? res.status}`)
  const txt = body?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!txt) throw Errors.conflict('GEMINI_EMPTY', '장소를 추출하지 못했어요')
  let parsed: { region?: string; title?: string; places?: ExtractedPlace[] }
  try { parsed = JSON.parse(txt) } catch { throw Errors.conflict('GEMINI_PARSE', '추출 결과를 해석하지 못했어요') }
  return { region: parsed.region ?? '', title: (parsed.title ?? '').slice(0, 40), places: (parsed.places ?? []).filter((p) => p.name).slice(0, 15) }
}

// ── 3) 장소명 → 좌표 (카카오 로컬 우선, TourAPI 폴백) ──────────────
async function kakaoLocal(name: string, regionKo: string): Promise<{ lat: number; lng: number } | null> {
  if (!env.KAKAO_REST_API_KEY) return null
  const q = encodeURIComponent(`${regionKo} ${name}`.trim())
  const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${q}&size=1`, {
    headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` },
  })
  if (!res.ok) return null // 서비스 비활성(심사 전) 등 → 폴백
  const body = (await res.json().catch(() => null)) as { documents?: { x?: string; y?: string }[] } | null
  const d = body?.documents?.[0]
  return d?.x && d?.y ? { lat: Number(d.y), lng: Number(d.x) } : null
}

async function tourapiGeo(name: string, regionKo: string): Promise<{ lat: number; lng: number; image: string | null } | null> {
  if (!env.TOURAPI_SERVICE_KEY) return null
  const sp = new URLSearchParams({ serviceKey: env.TOURAPI_SERVICE_KEY, MobileOS: 'ETC', MobileApp: 'TravelPack', _type: 'json', keyword: name, numOfRows: '5', arrange: 'O' })
  const t = await (await fetch(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${sp}`)).text()
  if (t.trimStart().startsWith('<')) return null
  let items: unknown
  try { items = JSON.parse(t)?.response?.body?.items?.item } catch { return null }
  const arr = (Array.isArray(items) ? items : items ? [items] : []) as { mapx?: string; mapy?: string; firstimage?: string; addr1?: string }[]
  const pick = arr.find((it) => regionKo && it.addr1?.includes(regionKo) && it.mapx) ?? arr.find((it) => it.mapx)
  return pick ? { lat: Number(pick.mapy), lng: Number(pick.mapx), image: pick.firstimage || null } : null
}

async function geocode(name: string, regionKo: string): Promise<{ lat: number; lng: number; image: string | null } | null> {
  const k = await kakaoLocal(name, regionKo).catch(() => null)
  if (k) {
    // 카카오는 사진이 없으니 TourAPI에서 이미지만 보조 시도(있으면)
    const t = await tourapiGeo(name, regionKo).catch(() => null)
    return { lat: k.lat, lng: k.lng, image: t?.image ?? null }
  }
  return tourapiGeo(name, regionKo).catch(() => null)
}

// ── 4) 전체 오케스트레이션 → DRAFT 코스 생성 ─────────────────────
export interface FromVideoResult { courseId: bigint; title: string; region: string; spotCount: number; skipped: string[] }

export async function buildCourseFromVideo(prisma: PrismaClient, userId: bigint, url: string, providedCaption?: string): Promise<FromVideoResult> {
  const { title: vTitle, text } = await fetchCaption(url, providedCaption)
  const { region: regionName, title: aiTitle, places } = await extractPlaces(text)
  if (places.length === 0) throw Errors.badRequest('NO_PLACES', '영상에서 장소를 찾지 못했어요. 장소가 적힌 영상인지 확인해 주세요')

  // 지역 매칭(없으면 추후 좌표 주소로 추론)
  let region = regionName ? await prisma.region.findFirst({ where: { name: { contains: regionName } }, select: { id: true, name: true } }) : null

  const resolved: ResolvedSpot[] = []
  const skipped: string[] = []
  for (const p of places) {
    const g = await geocode(p.name, region?.name ?? regionName)
    if (g) resolved.push({ name: p.name, category: p.type || '관광지', lat: g.lat, lng: g.lng, image: g.image })
    else skipped.push(p.name)
  }
  if (resolved.length < 2) throw Errors.badRequest('TOO_FEW', '좌표가 확인된 장소가 너무 적어요')

  // 지역 못 찾았으면 첫 스팟 좌표 기준 가장 가까운 지역으로 (간단히 첫 매칭 지역 사용)
  if (!region) {
    const all = await prisma.region.findMany({ select: { id: true, name: true, slug: true } })
    region = all.find((r) => regionName?.includes(r.name)) ?? all[0] ?? null
  }
  if (!region) throw Errors.badRequest('NO_REGION', '지역을 파악하지 못했어요')

  // 스팟 find-or-create
  const spotIds: bigint[] = []
  let cover: string | null = null
  for (const s of resolved) {
    let spot = await prisma.spot.findFirst({ where: { regionId: region.id, name: s.name }, select: { id: true } })
    if (!spot) {
      spot = await prisma.spot.create({
        data: {
          regionId: region.id, name: s.name, category: s.category, lat: s.lat, lng: s.lng,
          summary: `${region.name} ${s.category}`, address: `${region.name} 일대`, avgStayMinutes: 60, source: 'AI_VIDEO',
          ...(s.image ? { images: { create: [{ url: s.image, sourceCredit: '한국관광공사', source: 'TOURAPI', sourceId: 'aivideo', sortOrder: 0 }] } } : {}),
        },
        select: { id: true },
      })
    }
    spotIds.push(spot.id)
    if (!cover && s.image) cover = s.image
  }
  const yid = youtubeId(url)
  if (!cover && yid) cover = `https://i.ytimg.com/vi/${yid}/hqdefault.jpg`

  const days = spotIds.length >= 6 ? 2 : 1
  const perDay = Math.ceil(spotIds.length / days)
  const title = `🎬 ${aiTitle || vTitle || `${region.name} 영상 코스`}`.slice(0, 60)
  const course = await prisma.course.create({
    data: {
      regionId: region.id, title, summary: `영상에서 자동 생성한 코스 (출처: ${url})`,
      durationDays: days, status: 'DRAFT', authorType: 'USER', authorUserId: userId, createdBy: null,
      source: 'AI_VIDEO', coverImageUrl: cover,
      items: { create: spotIds.map((spotId, i) => ({ dayNo: Math.floor(i / perDay) + 1, sortOrder: (i % perDay) + 1, spotId, stayMinutes: 60 })) },
    },
    select: { id: true },
  })
  return { courseId: course.id, title, region: region.name, spotCount: spotIds.length, skipped }
}
