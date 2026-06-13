import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { Errors } from '../../lib/errors.js'
import { created, h, noContent, ok } from '../../lib/respond.js'
import { validateBody } from '../../middleware/validate.js'
import { requireUser } from '../../middleware/auth.js'
import { nextCursorOf, parseId, parsePage, sanitizeText } from '../../lib/util.js'

// 크리에이터(일반 사용자)가 자신만의 여행팩(코스)을 만들어 검수 요청하는 API.
// 발행은 관리자 CMS의 기존 4-eyes 워크플로가 담당(작성자=사용자, 승인자=관리자라 자연 분리).
export const creatorRouter = Router()

const PRICE_MAX = 1_000_000 // 1회 등록 가격 상한(원). 정책상 상향 조정 가능

const itemSchema = z.object({
  dayNo: z.number().int().min(1).max(30),
  sortOrder: z.number().int().min(0).max(50),
  spotId: z.coerce.bigint(),
  stayMinutes: z.number().int().min(0).max(1440).optional(),
  transportToNext: z.enum(['WALK', 'BUS', 'TAXI', 'CAR']).optional(),
  transportMinutes: z.number().int().min(0).max(1440).optional(),
  note: z.string().max(300).optional(),
})

const courseBodySchema = z.object({
  title: z.string().min(2).max(120),
  regionId: z.coerce.bigint(),
  summary: z.string().max(500).optional(),
  durationDays: z.number().int().min(1).max(30),
  estCost: z.number().int().min(0).max(100_000_000).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  price: z.number().int().min(0).max(PRICE_MAX).optional(),
  themeIds: z.array(z.coerce.bigint()).max(10).optional(),
  items: z.array(itemSchema).max(100).optional(),
})

type CourseBody = z.infer<typeof courseBodySchema>

/** 작성자 본인 소유의 USER 코스만 조회(없으면 404). */
async function getOwnedCourse(courseId: bigint, userId: bigint) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, authorType: 'USER', authorUserId: userId },
  })
  if (!course) throw Errors.notFound('내 코스')
  return course
}

/** 입력 구성(지역·테마·스팟·일자)의 정합성 검증. */
async function validateComposition(body: CourseBody) {
  const region = await prisma.region.findUnique({ where: { id: body.regionId }, select: { id: true } })
  if (!region) throw Errors.badRequest('REGION_NOT_FOUND', '존재하지 않는 지역입니다')

  if (body.themeIds?.length) {
    const themes = await prisma.theme.findMany({ where: { id: { in: body.themeIds } }, select: { id: true } })
    if (themes.length !== new Set(body.themeIds.map(String)).size) {
      throw Errors.badRequest('THEME_NOT_FOUND', '존재하지 않는 테마가 포함되어 있습니다')
    }
  }

  const items = body.items ?? []
  for (const it of items) {
    if (it.dayNo > body.durationDays) {
      throw Errors.badRequest('ITEM_DAY_OUT_OF_RANGE', `${it.dayNo}일차는 여행 기간(${body.durationDays}일)을 벗어납니다`)
    }
  }
  // (dayNo, sortOrder) 중복 금지
  const seen = new Set<string>()
  for (const it of items) {
    const key = `${it.dayNo}:${it.sortOrder}`
    if (seen.has(key)) throw Errors.badRequest('ITEM_DUPLICATE_ORDER', `${it.dayNo}일차에 순서가 중복됩니다`)
    seen.add(key)
  }
  if (items.length) {
    const spotIds = [...new Set(items.map((i) => i.spotId.toString()))].map(BigInt)
    const spots = await prisma.spot.findMany({ where: { id: { in: spotIds }, status: 'ACTIVE' }, select: { id: true } })
    if (spots.length !== spotIds.length) {
      throw Errors.badRequest('SPOT_NOT_FOUND', '존재하지 않거나 비공개인 관광지가 포함되어 있습니다')
    }
  }
}

function itemCreateData(body: CourseBody): Prisma.CourseItemCreateWithoutCourseInput[] {
  return (body.items ?? []).map((it) => ({
    dayNo: it.dayNo,
    sortOrder: it.sortOrder,
    spot: { connect: { id: it.spotId } },
    stayMinutes: it.stayMinutes ?? null,
    transportToNext: it.transportToNext ?? null,
    transportMinutes: it.transportMinutes ?? null,
    note: it.note ? sanitizeText(it.note) : null,
  }))
}

const fullInclude = {
  region: { select: { id: true, name: true } },
  themes: { include: { theme: { select: { id: true, name: true } } } },
  items: {
    orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }],
    include: { spot: { select: { id: true, name: true, category: true, lat: true, lng: true, images: { take: 1, orderBy: { sortOrder: 'asc' } } } } },
  },
} satisfies Prisma.CourseInclude

type CourseFull = Prisma.CourseGetPayload<{ include: typeof fullInclude }>

function serializeMyCourse(course: CourseFull) {
  const days = [...new Set(course.items.map((i) => i.dayNo))].sort((a, b) => a - b).map((dayNo) => ({
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
          lat: i.spot.lat,
          lng: i.spot.lng,
          thumbnail: i.spot.images[0]?.url ?? null,
        },
      })),
  }))
  return {
    id: course.id,
    title: course.title,
    summary: course.summary,
    cover: course.coverImageUrl,
    region: course.region,
    durationDays: course.durationDays,
    estCost: course.estCost,
    price: course.price,
    status: course.status,
    salesCount: course.salesCount,
    publishedAt: course.publishedAt,
    themes: course.themes.map((t) => t.theme),
    spotCount: course.items.length,
    days,
    editable: course.status === 'DRAFT',
  }
}

// 내 코스 목록(모든 상태)
creatorRouter.get(
  '/me/courses',
  requireUser,
  h(async (req, res) => {
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>)
    const courses = await prisma.course.findMany({
      where: { authorType: 'USER', authorUserId: req.userId!, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
      include: { region: { select: { name: true } }, _count: { select: { items: true } } },
    })
    ok(res, {
      items: courses.map((c) => ({
        id: c.id,
        title: c.title,
        cover: c.coverImageUrl,
        region: c.region.name,
        status: c.status,
        durationDays: c.durationDays,
        spotCount: c._count.items,
        price: c.price,
        salesCount: c.salesCount,
        publishedAt: c.publishedAt,
      })),
      nextCursor: nextCursorOf(courses, limit),
    })
  }),
)

// 내 코스 상세(모든 상태 — 항상 전체 콘텐츠)
creatorRouter.get(
  '/me/courses/:id',
  requireUser,
  h(async (req, res) => {
    await getOwnedCourse(parseId(req.params.id), req.userId!)
    const course = await prisma.course.findUniqueOrThrow({ where: { id: parseId(req.params.id) }, include: fullInclude })
    ok(res, serializeMyCourse(course))
  }),
)

// 코스 생성(DRAFT)
creatorRouter.post(
  '/me/courses',
  requireUser,
  validateBody(courseBodySchema),
  h(async (req, res) => {
    const body = req.body as CourseBody
    await validateComposition(body)
    const course = await prisma.course.create({
      data: {
        regionId: body.regionId,
        title: sanitizeText(body.title),
        summary: body.summary ? sanitizeText(body.summary) : null,
        durationDays: body.durationDays,
        estCost: body.estCost ?? null,
        coverImageUrl: body.coverImageUrl ?? null,
        price: body.price ?? 0,
        status: 'DRAFT',
        source: 'USER',
        authorType: 'USER',
        authorUserId: req.userId!,
        createdBy: null,
        ...(body.themeIds?.length ? { themes: { create: body.themeIds.map((themeId) => ({ themeId })) } } : {}),
        ...(body.items?.length ? { items: { create: itemCreateData(body) } } : {}),
      },
      include: fullInclude,
    })
    created(res, serializeMyCourse(course))
  }),
)

// 코스 수정(DRAFT만, 테마·아이템 전체 교체)
creatorRouter.put(
  '/me/courses/:id',
  requireUser,
  validateBody(courseBodySchema),
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const existing = await getOwnedCourse(id, req.userId!)
    if (existing.status !== 'DRAFT') {
      throw Errors.conflict('COURSE_NOT_EDITABLE', '검수 중이거나 발행된 코스는 수정할 수 없습니다. 먼저 검수를 회수하세요')
    }
    const body = req.body as CourseBody
    await validateComposition(body)

    await prisma.$transaction([
      prisma.courseItem.deleteMany({ where: { courseId: id } }),
      prisma.courseTheme.deleteMany({ where: { courseId: id } }),
      prisma.course.update({
        where: { id },
        data: {
          regionId: body.regionId,
          title: sanitizeText(body.title),
          summary: body.summary ? sanitizeText(body.summary) : null,
          durationDays: body.durationDays,
          estCost: body.estCost ?? null,
          coverImageUrl: body.coverImageUrl ?? null,
          price: body.price ?? 0,
          ...(body.themeIds?.length ? { themes: { create: body.themeIds.map((themeId) => ({ themeId })) } } : {}),
          ...(body.items?.length ? { items: { create: itemCreateData(body) } } : {}),
        },
      }),
    ])
    const course = await prisma.course.findUniqueOrThrow({ where: { id }, include: fullInclude })
    ok(res, serializeMyCourse(course))
  }),
)

// 검수 요청: DRAFT → IN_REVIEW (관리자 CMS에서 4-eyes 발행)
creatorRouter.post(
  '/me/courses/:id/submit',
  requireUser,
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const course = await getOwnedCourse(id, req.userId!)
    if (course.status !== 'DRAFT') throw Errors.conflict('COURSE_INVALID_TRANSITION', '임시저장(DRAFT) 코스만 검수 요청할 수 있습니다')
    const itemCount = await prisma.courseItem.count({ where: { courseId: id } })
    if (itemCount === 0) throw Errors.conflict('COURSE_EMPTY', '구성 스팟이 없는 코스는 검수 요청할 수 없습니다')
    const updated = await prisma.course.update({ where: { id }, data: { status: 'IN_REVIEW' } })
    ok(res, { courseId: updated.id, status: updated.status })
  }),
)

// 검수 회수: IN_REVIEW → DRAFT (다시 수정 가능)
creatorRouter.post(
  '/me/courses/:id/withdraw',
  requireUser,
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const course = await getOwnedCourse(id, req.userId!)
    if (course.status !== 'IN_REVIEW') throw Errors.conflict('COURSE_INVALID_TRANSITION', '검수 중인 코스만 회수할 수 있습니다')
    const updated = await prisma.course.update({ where: { id }, data: { status: 'DRAFT' } })
    ok(res, { courseId: updated.id, status: updated.status })
  }),
)

// 코스 삭제(DRAFT만 — 발행/판매 이력이 있으면 보존)
creatorRouter.delete(
  '/me/courses/:id',
  requireUser,
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const course = await getOwnedCourse(id, req.userId!)
    if (course.status !== 'DRAFT') {
      throw Errors.conflict('COURSE_NOT_DELETABLE', '검수 중이거나 발행된 코스는 삭제할 수 없습니다')
    }
    await prisma.course.delete({ where: { id } })
    noContent(res)
  }),
)
