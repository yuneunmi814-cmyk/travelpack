import { env } from '../../config/env.js'
import { Errors } from '../../lib/errors.js'

// 공공데이터 관광 3종 클라이언트 (동일 TOURAPI_SERVICE_KEY 사용):
//  - 반려동물 동반여행: KorService2/detailPetTour2 (contentId)
//  - 무장애 여행: KorWithService2/detailWithTour2 (contentId)
//  - 연관 관광지: TarRlteTarService1/areaBasedList1 (법정동 areaCd+signguCd+baseYm)
//  - contentId 해석: KorService2/searchKeyword2 (이름→contentId 백필)
const KOR = 'https://apis.data.go.kr/B551011/KorService2'
const KORWITH = 'https://apis.data.go.kr/B551011/KorWithService2'
const TARRLTE = 'https://apis.data.go.kr/B551011/TarRlteTarService1'
const MOBILE_OS = 'ETC'
const MOBILE_APP = 'TravelPack'

// 테스트 주입 지점 — 실제 HTTP 대신 가짜 응답을 넣는다.
export type Transport = (url: string) => Promise<unknown>
let transport: Transport = async (url) => {
  const res = await fetch(url)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    const code = /<returnReasonCode>(\d+)<\/returnReasonCode>/.exec(text)?.[1]
    throw Errors.conflict('TOURAPI_ERROR', `공공데이터 오류 응답${code ? ` (코드 ${code})` : ''} — serviceKey/쿼터 확인`)
  }
  return JSON.parse(text)
}
export function setTourismTransportForTest(fn: Transport): void { transport = fn }

function serviceKey(): string {
  if (!env.TOURAPI_SERVICE_KEY) throw Errors.notConfigured('TourAPI serviceKey(TOURAPI_SERVICE_KEY)')
  return env.TOURAPI_SERVICE_KEY
}

function buildUrl(base: string, op: string, params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  sp.set('serviceKey', serviceKey())
  sp.set('MobileOS', MOBILE_OS)
  sp.set('MobileApp', MOBILE_APP)
  sp.set('_type', 'json')
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v))
  return `${base}/${op}?${sp.toString()}`
}

function items<T>(json: unknown): T[] {
  const body = (json as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: '' | { item?: T | T[] } } } }).response
  if (body?.header?.resultCode && body.header.resultCode !== '0000') {
    throw Errors.conflict('TOURAPI_ERROR', `공공데이터: ${body.header.resultMsg ?? body.header.resultCode}`)
  }
  const raw = body?.body?.items
  const item = raw ? raw.item : undefined
  return item ? (Array.isArray(item) ? item : [item]) : []
}

// ── 반려동물 동반여행 ──
export interface PetTourRaw {
  contentid: string
  acmpyTypeCd?: string      // 동반 유형(예: 일부구역 동반가능)
  acmpyPsblCpam?: string    // 동반 가능 동물
  acmpyNeedMtr?: string     // 동반 시 필요사항(목줄 등)
  etcAcmpyInfo?: string     // 기타 안내
  relaPosesFclty?: string   // 비치 시설
  relaFrnshPrdlst?: string  // 구비 물품
  relaRntlPrdlst?: string   // 대여 물품
}
export async function fetchPetTour(contentId: string): Promise<PetTourRaw | null> {
  const list = items<PetTourRaw>(await transport(buildUrl(KOR, 'detailPetTour2', { contentId })))
  return list[0] ?? null
}

// ── 무장애 여행 ──
export interface BarrierFreeRaw {
  contentid: string
  wheelchair?: string
  parking?: string
  restroom?: string
  elevator?: string
  publictransport?: string
  exit?: string
  route?: string
  ticketoffice?: string
  promotion?: string
  stairroom?: string
  auditorium?: string
  braileblock?: string
  audioguide?: string
  guidehuman?: string
  bigprint?: string
  hearinghandicapetc?: string
  signguide?: string
  videoguide?: string
}
export async function fetchBarrierFree(contentId: string): Promise<BarrierFreeRaw | null> {
  const list = items<BarrierFreeRaw>(await transport(buildUrl(KORWITH, 'detailWithTour2', { contentId })))
  return list[0] ?? null
}

// ── 연관 관광지(데이터랩) ──
export interface RelatedRaw {
  tAtsNm: string            // 중심 관광지명
  rlteTatsNm: string        // 연관 관광지명
  rlteCtgryLclsNm?: string  // 대분류
  rlteCtgryMclsNm?: string  // 중분류
  rlteCtgrySclsNm?: string  // 소분류
  rlteRank?: string
  rlteRegnNm?: string
  rlteSignguNm?: string
}
export async function fetchRelated(p: { areaCd: string; signguCd: string; baseYm: string; pageNo?: number; numOfRows?: number }): Promise<RelatedRaw[]> {
  return items<RelatedRaw>(await transport(buildUrl(TARRLTE, 'areaBasedList1', {
    areaCd: p.areaCd, signguCd: p.signguCd, baseYm: p.baseYm,
    pageNo: p.pageNo ?? 1, numOfRows: p.numOfRows ?? 500,
  })))
}

// ── 이름 → contentId 해석(백필) ──
export interface KeywordItem { contentid: string; contenttypeid?: string; title: string; firstimage?: string; mapx?: string; mapy?: string }
export async function searchContentId(keyword: string, areaCode?: number): Promise<string | null> {
  const list = items<KeywordItem>(await transport(buildUrl(KOR, 'searchKeyword2', { keyword, areaCode, arrange: 'A', numOfRows: 20, pageNo: 1 })))
  const norm = (s: string) => (s || '').replace(/\s+/g, '').replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '')
  const w = norm(keyword)
  // 정규화 동일 > 시작 일치 우선, ct12(관광지) 가산
  const scored = list
    .map((p) => {
      const t = norm(p.title)
      let rank = 9
      if (t === w) rank = 0
      else if (t.startsWith(w) || w.startsWith(t)) rank = 1
      return { p, rank: rank + (String(p.contenttypeid) === '12' ? 0 : 0.3), len: (p.title || '').length }
    })
    .filter((x) => x.rank < 5)
    .sort((a, b) => a.rank - b.rank || a.len - b.len)
  return scored[0]?.p.contentid ?? null
}
