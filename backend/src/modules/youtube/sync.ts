import type { PrismaClient } from '@prisma/client'
import { fetchTravelVideos, type YtVideo } from './client.js'

export interface YoutubeSyncResult { region: string; videos: number; buzz: number }

// 지역명 → 검색 쿼리 (여행 의도 강화)
function queryFor(name: string): string { return `${name} 여행` }

// 지역 화제도 — 상위 영상 조회수 합을 로그 스케일로 (1M views ≈ 60, 10M ≈ 70). 추천 랭킹/배지용.
export function computeBuzz(vids: YtVideo[]): number {
  const sum = vids.reduce((a, v) => a + v.viewCount, 0)
  return sum > 0 ? Math.round(Math.log10(sum + 1) * 10) : 0
}

// 지역 1곳 동기화 (멱등: 해당 지역 영상 교체 + buzzScore 갱신)
export async function syncYoutubeRegion(
  prisma: PrismaClient,
  region: { id: bigint; name: string },
  opts: { want?: number; dryRun?: boolean } = {},
): Promise<YoutubeSyncResult> {
  const want = opts.want ?? 8
  const vids = await fetchTravelVideos(queryFor(region.name), want)
  const buzz = computeBuzz(vids)
  if (opts.dryRun) return { region: region.name, videos: vids.length, buzz }

  await prisma.video.deleteMany({ where: { regionId: region.id } })
  let order = 0
  for (const v of vids) {
    const data = {
      regionId: region.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnailUrl: v.thumbnailUrl,
      viewCount: BigInt(v.viewCount),
      publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
      durationSec: v.durationSec,
      sortOrder: order,
    }
    await prisma.video.upsert({ where: { youtubeId: v.youtubeId }, update: data, create: { youtubeId: v.youtubeId, ...data } })
    order++
  }
  await prisma.region.update({ where: { id: region.id }, data: { buzzScore: buzz } })
  return { region: region.name, videos: vids.length, buzz }
}

// 전체 지역 동기화 (지역별 1회 검색 = 100 units → 23지역 ≈ 2,300 units, 쿼터 내)
export async function syncYoutubeAll(
  prisma: PrismaClient,
  opts: { want?: number; dryRun?: boolean } = {},
): Promise<YoutubeSyncResult[]> {
  const regions = await prisma.region.findMany({
    where: { isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: 'asc' },
  })
  const results: YoutubeSyncResult[] = []
  for (const r of regions) {
    try {
      results.push(await syncYoutubeRegion(prisma, r, opts))
    } catch (e) {
      console.error(`  ✖ ${r.name}:`, e instanceof Error ? e.message : e)
    }
  }
  return results
}
