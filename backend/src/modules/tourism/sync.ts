import type { PrismaClient } from '@prisma/client'
import { fetchPetTour, fetchBarrierFree, fetchRelated, searchContentId, type PetTourRaw, type BarrierFreeRaw, type RelatedRaw } from './client.js'
import { TOURISM_REGIONS, RELATED_BASE_YMS } from './regions.js'

const norm = (s: string) => (s || '').replace(/\s+/g, '').replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').toLowerCase()
const clean = (v?: string) => { const t = (v ?? '').trim(); return t && t !== '-' ? t : undefined }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// 반려동물: 동반 가능 정보만 정리. 명시적 '불가'면 petFriendly=false.
function toPetInfo(raw: PetTourRaw | null): { info: Record<string, string> | null; friendly: boolean } {
  if (!raw) return { info: null, friendly: false }
  const info: Record<string, string> = {}
  const map: [keyof PetTourRaw, string][] = [
    ['acmpyTypeCd', '동반유형'], ['acmpyPsblCpam', '동반가능동물'], ['acmpyNeedMtr', '준비물'],
    ['etcAcmpyInfo', '안내'], ['relaPosesFclty', '비치시설'], ['relaRntlPrdlst', '대여'],
  ]
  for (const [k, label] of map) { const v = clean(raw[k] as string | undefined); if (v) info[label] = v }
  if (Object.keys(info).length === 0) return { info: null, friendly: false }
  const type = raw.acmpyTypeCd ?? ''
  const friendly = !/불가|불가능/.test(type)
  return { info, friendly }
}

// 무장애: 비어있지 않은 항목만.
function toBarrierFree(raw: BarrierFreeRaw | null): Record<string, string> | null {
  if (!raw) return null
  const info: Record<string, string> = {}
  const map: [keyof BarrierFreeRaw, string][] = [
    ['wheelchair', '휠체어'], ['parking', '주차'], ['restroom', '장애인화장실'], ['elevator', '엘리베이터'],
    ['publictransport', '대중교통/접근'], ['exit', '출입'], ['route', '이동경로'], ['braileblock', '점자블록'],
    ['audioguide', '음성안내'], ['guidehuman', '안내인'], ['signguide', '수어안내'], ['bigprint', '큰글씨'],
  ]
  for (const [k, label] of map) { const v = clean(raw[k] as string | undefined); if (v) info[label] = v }
  return Object.keys(info).length ? info : null
}

export interface TourismSyncResult { spotsProcessed: number; contentIdBackfilled: number; pet: number; barrierFree: number; relatedSpots: number; regionsMissed: string[] }

export async function syncTourism(
  prisma: PrismaClient,
  opts: { regionSlug?: string; dryRun?: boolean; baseYm?: string } = {},
): Promise<TourismSyncResult> {
  const res: TourismSyncResult = { spotsProcessed: 0, contentIdBackfilled: 0, pet: 0, barrierFree: 0, relatedSpots: 0, regionsMissed: [] }

  const regions = await prisma.region.findMany({
    where: opts.regionSlug ? { slug: opts.regionSlug } : { slug: { in: Object.keys(TOURISM_REGIONS) } },
  })

  for (const region of regions) {
    const cfg = TOURISM_REGIONS[region.slug]
    if (!cfg) continue
    const spots = await prisma.spot.findMany({ where: { regionId: region.id, status: 'ACTIVE' } })

    // 1) 연관 관광지: 시군구별 조회 → 중심관광지명→연관목록 맵
    const relatedMap = new Map<string, { name: string; category?: string; rank: number }[]>()
    for (const signguCd of cfg.signguCds) {
      let rows: RelatedRaw[] = []
      for (const baseYm of (opts.baseYm ? [opts.baseYm] : RELATED_BASE_YMS)) {
        try { rows = await fetchRelated({ areaCd: cfg.areaCd, signguCd, baseYm }) } catch { rows = [] }
        await sleep(250)
        if (rows.length) break
      }
      for (const r of rows) {
        const key = norm(r.tAtsNm)
        if (!key || !r.rlteTatsNm) continue
        const arr = relatedMap.get(key) ?? []
        if (!arr.some((x) => x.name === r.rlteTatsNm)) {
          arr.push({ name: r.rlteTatsNm, category: clean(r.rlteCtgryMclsNm) ?? clean(r.rlteCtgryLclsNm), rank: Number(r.rlteRank) || 99 })
        }
        relatedMap.set(key, arr)
      }
    }
    if (relatedMap.size === 0) res.regionsMissed.push(region.slug)

    // 2) 스팟별 contentId 백필 + 반려동물/무장애 + 연관 매칭
    for (const spot of spots) {
      res.spotsProcessed++
      let contentId = spot.tourapiContentId

      if (!contentId) {
        // 유명 관광지는 areaCode 없는 전국검색이 더 잘 잡힌다(이름이 충분히 고유).
        try { contentId = await searchContentId(spot.name) } catch { contentId = null }
        await sleep(250)
        if (contentId) {
          res.contentIdBackfilled++
          if (!opts.dryRun) {
            // 유니크 충돌(다른 스팟이 이미 점유) 시 건너뜀
            try { await prisma.spot.update({ where: { id: spot.id }, data: { tourapiContentId: contentId } }) } catch { contentId = spot.tourapiContentId }
          }
        }
      }

      const data: Record<string, unknown> = {}

      if (contentId) {
        try {
          const pet = toPetInfo(await fetchPetTour(contentId)); await sleep(200)
          if (pet.info) { data.petInfo = pet.info; data.petFriendly = pet.friendly; res.pet++ }
        } catch { /* skip */ }
        try {
          const bf = toBarrierFree(await fetchBarrierFree(contentId)); await sleep(200)
          if (bf) { data.barrierFree = bf; data.hasBarrierFree = true; res.barrierFree++ }
        } catch { /* skip */ }
      }

      const related = relatedMap.get(norm(spot.name))
      if (related && related.length) {
        data.relatedSpots = related.sort((a, b) => a.rank - b.rank).slice(0, 8)
        res.relatedSpots++
      }

      if (!opts.dryRun && Object.keys(data).length) {
        await prisma.spot.update({ where: { id: spot.id }, data })
      }
    }
  }

  return res
}
