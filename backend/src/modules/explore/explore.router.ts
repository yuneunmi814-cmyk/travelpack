import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { Errors } from '../../lib/errors.js'
import { h, ok } from '../../lib/respond.js'
import { optionalUser } from '../../middleware/auth.js'
import { cached } from '../../lib/cache.js'
import { parseId, parsePage } from '../../lib/util.js'
import { nearbySpots } from '../../lib/geo.js'
import { todayOpenStatus } from '../../lib/openHours.js'
import { courseEntitlement } from '../marketplace/entitlement.js'

export const exploreRouter = Router()

const courseListInclude = {
  region: { select: { name: true } },
  themes: { include: { theme: { select: { id: true, name: true } } } },
  _count: { select: { items: true } },
} satisfies Prisma.CourseInclude

type CourseForList = Prisma.CourseGetPayload<{ include: typeof courseListInclude }>

function toCourseCard(c: CourseForList) {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    cover: c.coverImageUrl,
    region: c.region.name,
    durationDays: c.durationDays,
    spotCount: c._count.items,
    estCost: c.estCost,
    themes: c.themes.map((t) => t.theme.name),
    saveCount: c.saveCount,
  }
}

// 유튜브 여행영상 카드 (코스/스팟 상세 임베드용)
const videoSelect = {
  id: true, youtubeId: true, title: true, channelTitle: true, thumbnailUrl: true, viewCount: true, durationSec: true,
} satisfies Prisma.VideoSelect
type VideoForCard = Prisma.VideoGetPayload<{ select: typeof videoSelect }>
function toVideoCard(v: VideoForCard) {
  return { id: v.id, youtubeId: v.youtubeId, title: v.title, channel: v.channelTitle, thumbnail: v.thumbnailUrl, viewCount: v.viewCount, durationSec: v.durationSec }
}

exploreRouter.get(
  '/home',
  optionalUser,
  h(async (req, res) => {
    const build = async (userId: bigint | null) => {
      const now = new Date()
      const [banners, recommended, regions, shorts] = await Promise.all([
        prisma.banner.findMany({
          where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, title: true, imageUrl: true, linkType: true, linkTarget: true },
        }),
        prisma.course.findMany({
          where: { status: 'PUBLISHED' },
          orderBy: [{ saveCount: 'desc' }, { id: 'desc' }],
          take: 24,
          include: courseListInclude,
        }),
        prisma.region.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, thumbnailUrl: true, visitorScore: true, buzzScore: true, _count: { select: { courses: { where: { status: 'PUBLISHED' } } } } },
        }),
        // 홈 '여행 쇼츠' 피드 — 전국 조회수 상위 영상
        prisma.video.findMany({
          where: { regionId: { not: null } },
          orderBy: { viewCount: 'desc' },
          take: 12,
          select: { ...videoSelect, region: { select: { name: true } } },
        }),
      ])

      const interestThemeIds = userId
        ? (await prisma.userInterest.findMany({ where: { userId }, select: { themeId: true } })).map((i) => i.themeId)
        : []
      const themeArgs: Prisma.ThemeFindManyArgs = interestThemeIds.length
        ? { where: { id: { in: interestThemeIds } }, take: 4 }
        : { take: 5, orderBy: { id: 'asc' } }
      const themes = await prisma.theme.findMany(themeArgs)
      const themeSections = (
        await Promise.all(
          themes.map(async (theme) => ({
            theme: { id: theme.id, name: theme.name },
            courses: (
              await prisma.course.findMany({
                where: { status: 'PUBLISHED', themes: { some: { themeId: theme.id } } },
                orderBy: { saveCount: 'desc' },
                take: 8,
                include: courseListInclude,
              })
            ).map(toCourseCard),
          })),
        )
      ).filter((s) => s.courses.length > 0)

      return {
        banners,
        recommendedCourses: recommended.map(toCourseCard),
        popularRegions: [...regions]
          // 인기 정렬: 방문자 빅데이터 점수 우선, 동률이면 코스 보유 수
          .sort((a, b) => b.visitorScore - a.visitorScore || b._count.courses - a._count.courses)
          .slice(0, 8)
          .map((r, i) => ({ id: r.id, name: r.name, thumbnail: r.thumbnailUrl, courseCount: r._count.courses, visitorScore: r.visitorScore, trending: i < 3 && r.visitorScore > 0 })),
        // 유튜브 화제도 기반 '요즘 뜨는 여행지' (추천 랭킹 신호)
        trendingRegions: [...regions]
          .filter((r) => r.buzzScore > 0)
          .sort((a, b) => b.buzzScore - a.buzzScore)
          .slice(0, 6)
          .map((r) => ({ id: r.id, name: r.name, thumbnail: r.thumbnailUrl, buzzScore: r.buzzScore })),
        // 홈 '여행 쇼츠' 피드
        shortsFeed: shorts.map((v) => ({
          id: v.id, youtubeId: v.youtubeId, title: v.title, channel: v.channelTitle,
          thumbnail: v.thumbnailUrl, viewCount: v.viewCount, durationSec: v.durationSec, region: v.region?.name ?? null,
        })),
        themeSections,
      }
    }
    // 개인화(관심 테마)가 들어가는 로그인 홈은 캐시하지 않는다
    const data = req.userId ? await build(req.userId) : await cached('home', () => build(null))
    ok(res, data)
  }),
)

exploreRouter.get(
  '/regions',
  h(async (_req, res) => {
    const regions = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true, thumbnailUrl: true },
    })
    ok(res, { regions })
  }),
)

exploreRouter.get(
  '/themes',
  h(async (_req, res) => {
    ok(res, { themes: await prisma.theme.findMany({ select: { id: true, name: true, icon: true } }) })
  }),
)

// 스팟 목록(지역 필터·이름 검색) — 코스 작성기의 스팟 선택용
exploreRouter.get(
  '/spots',
  h(async (req, res) => {
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>)
    const regionId = typeof req.query.regionId === 'string' && /^\d+$/.test(req.query.regionId) ? BigInt(req.query.regionId) : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const spots = await prisma.spot.findMany({
      where: {
        status: 'ACTIVE',
        ...(regionId ? { regionId } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      select: { id: true, name: true, category: true, lat: true, lng: true, images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } } },
    })
    ok(res, {
      items: spots.map((s) => ({ id: s.id, name: s.name, category: s.category, lat: s.lat, lng: s.lng, thumbnail: s.images[0]?.url ?? null })),
      nextCursor: spots.length === limit ? (spots[spots.length - 1]?.id.toString() ?? null) : null,
    })
  }),
)

exploreRouter.get(
  '/courses',
  h(async (req, res) => {
    const { limit } = parsePage(req.query as Record<string, unknown>)
    const sort = req.query.sort === 'latest' ? 'latest' : 'save'
    const regionId = typeof req.query.regionId === 'string' && /^\d+$/.test(req.query.regionId) ? BigInt(req.query.regionId) : undefined
    const durationDays = typeof req.query.durationDays === 'string' ? Number(req.query.durationDays) : undefined
    const themeIds =
      typeof req.query.themeIds === 'string'
        ? req.query.themeIds.split(',').filter((s) => /^\d+$/.test(s)).map(BigInt)
        : undefined

    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      ...(regionId ? { regionId } : {}),
      ...(durationDays && Number.isInteger(durationDays) ? { durationDays } : {}),
      ...(themeIds?.length ? { themes: { some: { themeId: { in: themeIds } } } } : {}),
    }

    // save/recommend 정렬은 (saveCount, id) 복합 커서, latest는 id 커서
    const rawCursor = typeof req.query.cursor === 'string' ? req.query.cursor : null
    let cursorWhere: Prisma.CourseWhereInput = {}
    if (rawCursor) {
      if (sort === 'latest' && /^\d+$/.test(rawCursor)) {
        cursorWhere = { id: { lt: BigInt(rawCursor) } }
      } else if (/^\d+_\d+$/.test(rawCursor)) {
        const [saveStr, idStr] = rawCursor.split('_') as [string, string]
        const save = Number(saveStr)
        cursorWhere = { OR: [{ saveCount: { lt: save } }, { saveCount: save, id: { lt: BigInt(idStr) } }] }
      }
    }

    const key = `courses:${sort}:${regionId ?? ''}:${durationDays ?? ''}:${themeIds?.join('.') ?? ''}:${rawCursor ?? ''}:${limit}`
    const data = await cached(key, async () => {
      const items = await prisma.course.findMany({
        where: { AND: [where, cursorWhere] },
        orderBy: sort === 'latest' ? [{ id: 'desc' }] : [{ saveCount: 'desc' }, { id: 'desc' }],
        take: limit,
        include: courseListInclude,
      })
      const last = items[items.length - 1]
      const nextCursor =
        items.length === limit && last ? (sort === 'latest' ? last.id.toString() : `${last.saveCount}_${last.id}`) : null
      return { items: items.map(toCourseCard), nextCursor }
    })
    ok(res, data)
  }),
)

exploreRouter.get(
  '/courses/:courseId',
  optionalUser,
  h(async (req, res) => {
    const id = parseId(req.params.courseId, 'courseId')
    const course = await prisma.course.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: {
        region: { select: { id: true, name: true } },
        author: { select: { id: true, nickname: true } },
        themes: { include: { theme: { select: { id: true, name: true } } } },
        items: {
          orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }],
          include: {
            spot: { select: { id: true, name: true, category: true, summary: true, lat: true, lng: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } } },
          },
        },
      },
    })
    if (!course) throw Errors.notFound('코스')

    prisma.course.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    const [agg, bookmark, entitlement, videos] = await Promise.all([
      prisma.review.aggregate({ where: { targetType: 'COURSE', targetId: id, status: 'VISIBLE' }, _avg: { rating: true }, _count: true }),
      req.userId
        ? prisma.bookmark.findUnique({ where: { userId_targetType_targetId: { userId: req.userId, targetType: 'COURSE', targetId: id } } })
        : null,
      courseEntitlement(course, req.userId ?? null),
      // 이 코스 지역의 여행영상(쇼츠)
      prisma.video.findMany({ where: { regionId: course.regionId }, orderBy: { sortOrder: 'asc' }, take: 6, select: videoSelect }),
    ])

    const allDays = [...new Set(course.items.map((i) => i.dayNo))].sort((a, b) => a - b).map((dayNo) => ({
      dayNo,
      items: course.items
        .filter((i) => i.dayNo === dayNo)
        .map((i) => ({
          id: i.id,
          order: i.sortOrder,
          stayMinutes: i.stayMinutes,
          transportToNext: i.transportToNext,
          transportMinutes: i.transportMinutes,
          note: i.note,
          spot: {
            id: i.spot.id,
            name: i.spot.name,
            category: i.spot.category,
            summary: i.spot.summary,
            lat: i.spot.lat,
            lng: i.spot.lng,
            thumbnail: i.spot.images[0]?.url ?? null,
          },
        })),
    }))

    // 유료 코스 미구매 시: 1일차만 미리보기로 노출하고 상세(좌표·메모·이후 일자)는 잠금
    const locked = !entitlement.entitled
    const days = locked
      ? allDays.slice(0, 1).map((d) => ({
          dayNo: d.dayNo,
          items: d.items.map((it) => ({
            spot: { id: it.spot.id, name: it.spot.name, category: it.spot.category, thumbnail: it.spot.thumbnail },
          })),
        }))
      : allDays

    ok(res, {
      id: course.id,
      title: course.title,
      summary: course.summary,
      cover: course.coverImageUrl,
      region: course.region,
      authorType: course.authorType,
      author: course.author ? { id: course.author.id, nickname: course.author.nickname } : null,
      price: course.price,
      durationDays: course.durationDays,
      estCost: course.estCost,
      themes: course.themes.map((t) => t.theme),
      spotCount: course.items.length,
      saveCount: course.saveCount,
      locked,
      entitlementReason: entitlement.reason,
      days,
      reviewSummary: { avg: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : null, count: agg._count },
      isBookmarked: req.userId ? Boolean(bookmark) : null,
      videos: videos.map(toVideoCard),
    })
  }),
)

exploreRouter.get(
  '/spots/:spotId',
  optionalUser,
  h(async (req, res) => {
    const id = parseId(req.params.spotId, 'spotId')
    const spot = await prisma.spot.findFirst({
      where: { id, status: 'ACTIVE' },
      include: { region: { select: { id: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!spot) throw Errors.notFound('관광지')

    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'ko'
    const [agg, nearby, bookmark, audioGuides, translation, videos] = await Promise.all([
      prisma.review.aggregate({ where: { targetType: 'SPOT', targetId: id, status: 'VISIBLE' }, _avg: { rating: true }, _count: true }),
      nearbySpots(id),
      req.userId
        ? prisma.bookmark.findUnique({ where: { userId_targetType_targetId: { userId: req.userId, targetType: 'SPOT', targetId: id } } })
        : null,
      // 오디오 가이드(오디) — 해당 언어, 오디오 보유 우선
      prisma.audioGuide.findMany({
        where: { spotId: id, langCode: lang },
        orderBy: [{ audioUrl: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
        take: 10,
      }),
      // 다국어 번역(영문 등) — lang이 ko가 아니면 적용
      lang !== 'ko' ? prisma.spotTranslation.findUnique({ where: { spotId_langCode: { spotId: id, langCode: lang } } }) : null,
      // 이 스팟 지역의 여행영상(쇼츠)
      prisma.video.findMany({ where: { regionId: spot.regionId }, orderBy: { sortOrder: 'asc' }, take: 6, select: videoSelect }),
    ])
    const { open, today } = todayOpenStatus(spot.openHours)

    ok(res, {
      id: spot.id,
      name: translation?.name ?? spot.name,
      category: spot.category,
      region: spot.region,
      summary: translation?.summary ?? spot.summary,
      description: translation?.description ?? spot.description,
      lang: translation ? lang : 'ko',
      tips: spot.tips,
      address: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      phone: spot.phone,
      openHours: spot.openHours,
      todayOpen: open,
      todayHours: today,
      admissionFee: spot.admissionFee,
      avgStayMinutes: spot.avgStayMinutes,
      images: spot.images.map((i) => ({ url: i.url, credit: i.sourceCredit })),
      reviewSummary: { avg: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : null, count: agg._count },
      nearbySpots: nearby.map((n) => ({ id: n.id, name: n.name, category: n.category, distanceM: Math.round(n.distance_m) })),
      isBookmarked: req.userId ? Boolean(bookmark) : null,
      audioGuides: audioGuides.map((a) => ({
        id: a.id, title: a.title, audioTitle: a.audioTitle, script: a.script,
        audioUrl: a.audioUrl, playTime: a.playTime, langCode: a.langCode, source: a.source,
      })),
      // 공공데이터 보강: 반려동물 동반·무장애·연관 관광지
      petInfo: spot.petInfo ?? null,
      barrierFree: spot.barrierFree ?? null,
      relatedSpots: (spot.relatedSpots as unknown[] | null) ?? [],
      // 유튜브 여행영상(이 지역 쇼츠)
      videos: videos.map(toVideoCard),
    })
  }),
)

exploreRouter.get(
  '/search',
  h(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!q) throw Errors.validation('검색어(q)를 입력해 주세요')
    const type = typeof req.query.type === 'string' ? req.query.type : null
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>, 10, 30)

    const wantCourses = !type || type === 'course'
    const wantSpots = !type || type === 'spot'
    const wantRegions = !type || type === 'region'

    const [courses, spots, regions] = await Promise.all([
      wantCourses
        ? prisma.course.findMany({
            where: {
              status: 'PUBLISHED',
              OR: [{ title: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }],
              ...(type === 'course' && cursor ? { id: { lt: cursor } } : {}),
            },
            orderBy: { id: 'desc' },
            take: limit,
            include: courseListInclude,
          })
        : [],
      wantSpots
        ? prisma.spot.findMany({
            where: {
              status: 'ACTIVE',
              name: { contains: q, mode: 'insensitive' },
              ...(type === 'spot' && cursor ? { id: { lt: cursor } } : {}),
            },
            orderBy: { id: 'desc' },
            take: limit,
            select: { id: true, name: true, category: true, address: true, region: { select: { name: true } } },
          })
        : [],
      wantRegions
        ? prisma.region.findMany({
            where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
            take: 5,
            select: { id: true, name: true, slug: true },
          })
        : [],
    ])

    ok(res, {
      courses: courses.map(toCourseCard),
      spots: spots.map((s) => ({ id: s.id, name: s.name, category: s.category, address: s.address, region: s.region.name })),
      regions,
    })
  }),
)
