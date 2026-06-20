import { readFileSync } from 'node:fs'
import type { PrismaClient } from '@prisma/client'

// build-youtube-courses.ts가 만든 결과(장소+좌표) → '🎬 유튜브 추천 코스' 생성.
// 멱등: course.tourapiContentId = 'yt:{videoId}' 마커로 중복 방지. seed-core(전체 재시드)와 prod 추가삽입 둘 다 사용.
interface YtResolved { name: string; lat: number; lng: number; image: string | null; matched: boolean }
interface YtCourse { slug: string; vid: string; src: string; title: string; theme: string; resolved: YtResolved[] }

const DATA: YtCourse[] = JSON.parse(readFileSync(new URL('./seed-youtube-courses.json', import.meta.url), 'utf8'))

export async function applyYoutubeCourses(
  prisma: PrismaClient,
  editorId: bigint,
  themeIdByName: Record<string, bigint>,
): Promise<number> {
  let created = 0
  for (const c of DATA) {
    if (c.resolved.length < 3) continue
    const region = await prisma.region.findFirst({ where: { slug: c.slug }, select: { id: true } })
    if (!region) continue
    const marker = `yt:${c.vid}`
    const exists = await prisma.course.findUnique({ where: { tourapiContentId: marker }, select: { id: true } })
    if (exists) continue // 멱등: 이미 있으면 건너뜀

    const spotIds: bigint[] = []
    let cover: string | null = null
    for (const s of c.resolved) {
      let spot = await prisma.spot.findFirst({
        where: { regionId: region.id, name: { contains: s.name } },
        select: { id: true, images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } } },
      })
      if (!spot) {
        spot = await prisma.spot.create({
          data: {
            regionId: region.id, name: s.name, category: '관광지', lat: s.lat, lng: s.lng,
            summary: '유튜브 추천 명소', address: `${c.slug} 일대`, avgStayMinutes: 60, source: 'YOUTUBE',
            ...(s.image ? { images: { create: [{ url: s.image, sourceCredit: '한국관광공사', source: 'TOURAPI', sourceId: 'yt', sortOrder: 0 }] } } : {}),
          },
          select: { id: true, images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } } },
        })
      }
      spotIds.push(spot.id)
      if (!cover && spot.images[0]?.url) cover = spot.images[0].url
      if (!cover && s.image) cover = s.image
    }
    if (!cover) cover = `https://i.ytimg.com/vi/${c.vid}/hqdefault.jpg`

    const days = spotIds.length >= 6 ? 2 : 1
    const perDay = Math.ceil(spotIds.length / days)
    const items = spotIds.map((spotId, i) => ({ dayNo: Math.floor(i / perDay) + 1, sortOrder: (i % perDay) + 1, spotId, stayMinutes: 60 }))
    const themeId = themeIdByName[c.theme]

    await prisma.course.create({
      data: {
        regionId: region.id,
        title: `🎬 유튜브 추천 · ${c.title}`,
        summary: `유튜브 영상 '${c.src}'에서 뽑은 코스`,
        durationDays: days, estCost: days * 50000,
        status: 'PUBLISHED', publishedAt: new Date(), createdBy: editorId,
        source: 'YOUTUBE', tourapiContentId: marker, coverImageUrl: cover, saveCount: 500,
        ...(themeId ? { themes: { create: [{ themeId }] } } : {}),
        items: { create: items },
      },
    })
    created++
  }
  return created
}
