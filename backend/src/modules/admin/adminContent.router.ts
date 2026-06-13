import { Router } from 'express'
import { z } from 'zod'
import { Prisma, TransportType } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { Errors } from '../../lib/errors.js'
import { created, h, noContent, ok } from '../../lib/respond.js'
import { validateBody } from '../../middleware/validate.js'
import { requireAdmin } from '../../middleware/auth.js'
import { nextCursorOf, parseId, parsePage } from '../../lib/util.js'
import { invalidateExploreCache } from '../../lib/cache.js'
import { settlement } from '../marketplace/payment.js'
import { logAudit } from './audit.js'

export const adminContentRouter = Router()

// ── 관광지 ──────────────────────────────────────────────

const spotBodySchema = z.object({
  name: z.string().min(1).max(100),
  regionId: z.coerce.bigint(),
  category: z.string().min(1).max(30),
  address: z.string().max(255).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  summary: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  tips: z.string().max(1000).optional(),
  openHours: z.record(z.unknown()).optional(),
  admissionFee: z.string().max(100).optional(),
  avgStayMinutes: z.number().int().positive().optional(),
  phone: z.string().max(30).optional(),
  checkinRadiusM: z.number().int().min(50).max(2000).nullable().optional(),
  images: z.array(z.object({ url: z.string().url(), credit: z.string().max(100).optional() })).max(10).optional(),
})

adminContentRouter.post(
  '/spots',
  requireAdmin('CONTENT_MANAGER'),
  validateBody(spotBodySchema),
  h(async (req, res) => {
    const body = req.body as z.infer<typeof spotBodySchema>
    const { images, openHours, ...rest } = body
    const spot = await prisma.spot.create({
      data: {
        ...rest,
        openHours: openHours as Prisma.InputJsonValue | undefined,
        images: images?.length ? { create: images.map((img, i) => ({ url: img.url, sourceCredit: img.credit, sortOrder: i })) } : undefined,
      },
    })
    await logAudit(req, 'SPOT_CREATE', 'spot', spot.id, undefined, body)
    created(res, { spotId: spot.id })
  }),
)

adminContentRouter.get(
  '/spots',
  requireAdmin(),
  h(async (req, res) => {
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const regionId = typeof req.query.regionId === 'string' && /^\d+$/.test(req.query.regionId) ? BigInt(req.query.regionId) : undefined
    const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined
    const items = await prisma.spot.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(regionId ? { regionId } : {}),
        ...(status ? { status } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: { region: { select: { name: true } }, _count: { select: { courseItems: true } } },
    })
    ok(res, {
      items: items.map((s) => ({
        id: s.id, name: s.name, category: s.category, region: s.region.name, status: s.status,
        source: s.source, usedInCourses: s._count.courseItems, checkinRadiusM: s.checkinRadiusM,
      })),
      nextCursor: nextCursorOf(items, limit),
    })
  }),
)

adminContentRouter.get(
  '/spots/:id',
  requireAdmin(),
  h(async (req, res) => {
    const spot = await prisma.spot.findUnique({
      where: { id: parseId(req.params.id) },
      include: { images: { orderBy: { sortOrder: 'asc' } }, region: { select: { id: true, name: true } } },
    })
    if (!spot) throw Errors.notFound('관광지')
    ok(res, spot)
  }),
)

adminContentRouter.put(
  '/spots/:id',
  requireAdmin('CONTENT_MANAGER'),
  validateBody(spotBodySchema),
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const before = await prisma.spot.findUnique({ where: { id } })
    if (!before) throw Errors.notFound('관광지')
    const body = req.body as z.infer<typeof spotBodySchema>
    const { images, openHours, ...rest } = body
    const spot = await prisma.spot.update({
      where: { id },
      data: {
        ...rest,
        openHours: openHours as Prisma.InputJsonValue | undefined,
        ...(images ? { images: { deleteMany: {}, create: images.map((img, i) => ({ url: img.url, sourceCredit: img.credit, sortOrder: i })) } } : {}),
      },
    })
    await invalidateExploreCache()
    await logAudit(req, 'SPOT_UPDATE', 'spot', id, { name: before.name, lat: before.lat, lng: before.lng }, body)
    ok(res, { spotId: spot.id })
  }),
)

adminContentRouter.delete(
  '/spots/:id',
  requireAdmin('CONTENT_MANAGER'),
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const usage = await prisma.courseItem.count({ where: { spotId: id } })
    if (usage > 0) {
      // 코스에 포함된 스팟은 삭제 대신 비활성화 (기획설계서 5장)
      await prisma.spot.update({ where: { id }, data: { status: 'INACTIVE' } })
      await invalidateExploreCache()
      await logAudit(req, 'SPOT_DEACTIVATE', 'spot', id)
      throw Errors.conflict('SPOT_IN_USE', '코스에 포함된 스팟이라 비활성화로 처리했습니다')
    }
    await prisma.spot.update({ where: { id }, data: { status: 'INACTIVE' } })
    await invalidateExploreCache()
    await logAudit(req, 'SPOT_DEACTIVATE', 'spot', id)
    noContent(res)
  }),
)

// ── 코스 + 발행 워크플로 ─────────────────────────────────

const courseItemSchema = z.object({
  dayNo: z.number().int().min(1).max(7),
  order: z.number().int().min(1).max(30),
  spotId: z.coerce.bigint(),
  stayMinutes: z.number().int().positive().optional(),
  transport: z.nativeEnum(TransportType).optional(),
  transportMinutes: z.number().int().positive().optional(),
  note: z.string().max(200).optional(),
})

const courseBodySchema = z.object({
  title: z.string().min(1).max(100),
  regionId: z.coerce.bigint(),
  summary: z.string().max(200).optional(),
  durationDays: z.number().int().min(1).max(7),
  estCost: z.number().int().nonnegative().optional(),
  coverImage: z.string().url().optional(),
  themeIds: z.array(z.coerce.bigint()).max(5).optional(),
  items: z.array(courseItemSchema).min(1).max(60),
})

async function validateCourseItems(items: z.infer<typeof courseItemSchema>[], durationDays: number): Promise<void> {
  const keys = new Set(items.map((i) => `${i.dayNo}-${i.order}`))
  if (keys.size !== items.length) throw Errors.validation('day/order 조합이 중복됐습니다')
  if (items.some((i) => i.dayNo > durationDays)) throw Errors.validation('durationDays를 넘는 dayNo가 있습니다')
  const spotIds = [...new Set(items.map((i) => i.spotId))]
  const activeCount = await prisma.spot.count({ where: { id: { in: spotIds }, status: 'ACTIVE' } })
  if (activeCount !== spotIds.length) throw Errors.validation('존재하지 않거나 비활성화된 스팟이 포함됐습니다')
}

function courseItemsCreate(items: z.infer<typeof courseItemSchema>[]) {
  return items.map((i) => ({
    dayNo: i.dayNo,
    sortOrder: i.order,
    spotId: i.spotId,
    stayMinutes: i.stayMinutes,
    transportToNext: i.transport,
    transportMinutes: i.transportMinutes,
    note: i.note,
  }))
}

adminContentRouter.post(
  '/courses',
  requireAdmin('CONTENT_MANAGER'),
  validateBody(courseBodySchema),
  h(async (req, res) => {
    const body = req.body as z.infer<typeof courseBodySchema>
    await validateCourseItems(body.items, body.durationDays)
    const course = await prisma.course.create({
      data: {
        title: body.title,
        regionId: body.regionId,
        summary: body.summary,
        durationDays: body.durationDays,
        estCost: body.estCost,
        coverImageUrl: body.coverImage,
        createdBy: req.adminId!,
        themes: body.themeIds?.length ? { create: body.themeIds.map((themeId) => ({ themeId })) } : undefined,
        items: { create: courseItemsCreate(body.items) },
      },
    })
    await logAudit(req, 'COURSE_CREATE', 'course', course.id, undefined, { title: body.title, status: 'DRAFT' })
    created(res, { courseId: course.id, status: course.status })
  }),
)

adminContentRouter.get(
  '/courses',
  requireAdmin(),
  h(async (req, res) => {
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>)
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const items = await prisma.course.findMany({
      where: {
        ...(status && ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'].includes(status) ? { status: status as never } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: {
        region: { select: { name: true } },
        creator: { select: { name: true } },
        author: { select: { nickname: true } },
        _count: { select: { items: true } },
      },
    })
    ok(res, {
      items: items.map((c) => ({
        id: c.id, title: c.title, region: c.region.name, status: c.status, durationDays: c.durationDays,
        spotCount: c._count.items,
        authorType: c.authorType,
        createdBy: c.creator?.name ?? (c.author ? `${c.author.nickname} (크리에이터)` : '—'),
        price: c.price, salesCount: c.salesCount,
        publishedAt: c.publishedAt, saveCount: c.saveCount,
      })),
      nextCursor: nextCursorOf(items, limit),
    })
  }),
)

adminContentRouter.get(
  '/courses/:id',
  requireAdmin(),
  h(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: parseId(req.params.id) },
      include: {
        region: { select: { id: true, name: true } },
        themes: { include: { theme: true } },
        items: { orderBy: [{ dayNo: 'asc' }, { sortOrder: 'asc' }], include: { spot: { select: { id: true, name: true } } } },
        creator: { select: { id: true, name: true } },
      },
    })
    if (!course) throw Errors.notFound('코스')
    ok(res, course)
  }),
)

adminContentRouter.put(
  '/courses/:id',
  requireAdmin('CONTENT_MANAGER'),
  validateBody(courseBodySchema),
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const course = await prisma.course.findUnique({ where: { id } })
    if (!course) throw Errors.notFound('코스')
    if (course.status === 'PUBLISHED' || course.status === 'IN_REVIEW') {
      throw Errors.conflict('COURSE_LOCKED', '발행/검수 중 코스는 회수(unpublish) 또는 반려 후 수정할 수 있습니다')
    }
    const body = req.body as z.infer<typeof courseBodySchema>
    await validateCourseItems(body.items, body.durationDays)

    // 수정하면 ARCHIVED → DRAFT 재편집 (상태 머신: ARCHIVED→DRAFT)
    await prisma.$transaction([
      prisma.courseTheme.deleteMany({ where: { courseId: id } }),
      prisma.courseItem.deleteMany({ where: { courseId: id } }),
      prisma.course.update({
        where: { id },
        data: {
          title: body.title,
          regionId: body.regionId,
          summary: body.summary,
          durationDays: body.durationDays,
          estCost: body.estCost,
          coverImageUrl: body.coverImage,
          status: 'DRAFT',
          themes: body.themeIds?.length ? { create: body.themeIds.map((themeId) => ({ themeId })) } : undefined,
          items: { create: courseItemsCreate(body.items) },
        },
      }),
    ])
    await logAudit(req, 'COURSE_UPDATE', 'course', id, { title: course.title, status: course.status }, { title: body.title, status: 'DRAFT' })
    ok(res, { courseId: id, status: 'DRAFT' })
  }),
)

async function transition(
  req: Parameters<typeof logAudit>[0],
  id: bigint,
  from: string[],
  to: 'IN_REVIEW' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED',
  action: string,
  guard?: (course: { createdBy: bigint | null }) => void,
) {
  const course = await prisma.course.findUnique({ where: { id } })
  if (!course) throw Errors.notFound('코스')
  if (!from.includes(course.status)) {
    throw Errors.conflict('COURSE_INVALID_TRANSITION', `${course.status} 상태에서는 불가능한 작업입니다`)
  }
  guard?.(course)
  const updated = await prisma.course.update({
    where: { id },
    data: { status: to, ...(to === 'PUBLISHED' ? { publishedAt: new Date() } : {}) },
  })
  await invalidateExploreCache()
  await logAudit(req, action, 'course', id, { status: course.status }, { status: to })
  return updated
}

adminContentRouter.post(
  '/courses/:id/submit',
  requireAdmin('CONTENT_MANAGER'),
  h(async (req, res) => {
    const updated = await transition(req, parseId(req.params.id), ['DRAFT'], 'IN_REVIEW', 'COURSE_SUBMIT')
    ok(res, { courseId: updated.id, status: updated.status })
  }),
)

adminContentRouter.post(
  '/courses/:id/publish',
  requireAdmin('CONTENT_MANAGER'),
  h(async (req, res) => {
    const updated = await transition(req, parseId(req.params.id), ['IN_REVIEW'], 'PUBLISHED', 'COURSE_PUBLISH', (course) => {
      // 4-eyes: 작성자 본인은 발행 승인 불가 (기획설계서 2.2절)
      if (course.createdBy === req.adminId) throw Errors.forbidden('작성자 본인은 발행을 승인할 수 없습니다 (4-eyes)')
    })
    ok(res, { courseId: updated.id, status: updated.status, publishedAt: updated.publishedAt })
  }),
)

adminContentRouter.post(
  '/courses/:id/reject',
  requireAdmin('CONTENT_MANAGER'),
  validateBody(z.object({ comment: z.string().min(1).max(500) })),
  h(async (req, res) => {
    const { comment } = req.body as { comment: string }
    const updated = await transition(req, parseId(req.params.id), ['IN_REVIEW'], 'DRAFT', `COURSE_REJECT:${comment.slice(0, 80)}`)
    ok(res, { courseId: updated.id, status: updated.status })
  }),
)

adminContentRouter.post(
  '/courses/:id/unpublish',
  requireAdmin('CONTENT_MANAGER'),
  h(async (req, res) => {
    const updated = await transition(req, parseId(req.params.id), ['PUBLISHED'], 'ARCHIVED', 'COURSE_UNPUBLISH')
    ok(res, { courseId: updated.id, status: updated.status })
  }),
)

// ── 마켓플레이스 정산 대시보드 ──────────────────────────────
// 크리에이터별 판매·정산(수수료 차감 후 지급액) 집계. 결제 완료(PAID) 구매 기준.
adminContentRouter.get(
  '/marketplace/settlements',
  requireAdmin('OPERATION_MANAGER'),
  h(async (_req, res) => {
    const purchases = await prisma.coursePurchase.findMany({
      where: { status: 'PAID' },
      select: {
        price: true,
        purchasedAt: true,
        course: { select: { authorUserId: true, author: { select: { nickname: true } } } },
      },
    })

    const byCreator = new Map<string, { authorId: string; nickname: string; salesCount: number; gross: number }>()
    let gross = 0
    for (const p of purchases) {
      gross += p.price
      const authorId = p.course.authorUserId?.toString()
      if (!authorId) continue // 에디터(공식) 유료 코스 등 — 작성자 없음
      const cur = byCreator.get(authorId) ?? { authorId, nickname: p.course.author?.nickname ?? '(탈퇴)', salesCount: 0, gross: 0 }
      cur.salesCount += 1
      cur.gross += p.price
      byCreator.set(authorId, cur)
    }

    const creators = [...byCreator.values()]
      .map((c) => {
        const s = settlement(c.gross)
        return { ...c, platformFee: s.platformFee, payout: s.creatorPayout }
      })
      .sort((a, b) => b.gross - a.gross)

    const total = settlement(gross)
    ok(res, {
      summary: {
        paidCount: purchases.length,
        grossRevenue: gross,
        platformFee: total.platformFee,
        creatorPayout: total.creatorPayout,
        feePercent: total.feePercent,
      },
      creators,
    })
  }),
)
