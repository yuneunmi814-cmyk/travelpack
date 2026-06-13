import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { Errors } from '../../lib/errors.js'
import { h, ok } from '../../lib/respond.js'
import { requireUser } from '../../middleware/auth.js'
import { nextCursorOf, parseId, parsePage } from '../../lib/util.js'
import { courseEntitlement } from './entitlement.js'
import { isPaymentEnabled, charge, settlement } from './payment.js'

// 크리에이터 마켓플레이스 — 사용자가 만든 여행팩(코스)을 둘러보고 구매.
export const marketplaceRouter = Router()

const cardInclude = {
  region: { select: { name: true } },
  themes: { include: { theme: { select: { id: true, name: true } } } },
  author: { select: { id: true, nickname: true } },
  _count: { select: { items: true } },
} satisfies Prisma.CourseInclude

type Card = Prisma.CourseGetPayload<{ include: typeof cardInclude }>

function toMarketCard(c: Card) {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    cover: c.coverImageUrl,
    region: c.region.name,
    durationDays: c.durationDays,
    spotCount: c._count.items,
    price: c.price,
    salesCount: c.salesCount,
    saveCount: c.saveCount,
    themes: c.themes.map((t) => t.theme.name),
    author: c.author ? { id: c.author.id, nickname: c.author.nickname } : null,
  }
}

// 마켓 목록 — 발행된 USER 코스. 정렬: popular(판매수)·latest·free
marketplaceRouter.get(
  '/marketplace/courses',
  h(async (req, res) => {
    const { limit } = parsePage(req.query as Record<string, unknown>)
    const sort = req.query.sort === 'latest' ? 'latest' : req.query.sort === 'free' ? 'free' : 'popular'
    const regionId = typeof req.query.regionId === 'string' && /^\d+$/.test(req.query.regionId) ? BigInt(req.query.regionId) : undefined
    const themeIds =
      typeof req.query.themeIds === 'string'
        ? req.query.themeIds.split(',').filter((s) => /^\d+$/.test(s)).map(BigInt)
        : undefined

    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      authorType: 'USER',
      ...(regionId ? { regionId } : {}),
      ...(sort === 'free' ? { price: 0 } : {}),
      ...(themeIds?.length ? { themes: { some: { themeId: { in: themeIds } } } } : {}),
    }

    const rawCursor = typeof req.query.cursor === 'string' ? req.query.cursor : null
    let cursorWhere: Prisma.CourseWhereInput = {}
    if (rawCursor) {
      if ((sort === 'latest' || sort === 'free') && /^\d+$/.test(rawCursor)) {
        cursorWhere = { id: { lt: BigInt(rawCursor) } }
      } else if (/^\d+_\d+$/.test(rawCursor)) {
        const [salesStr, idStr] = rawCursor.split('_') as [string, string]
        const sales = Number(salesStr)
        cursorWhere = { OR: [{ salesCount: { lt: sales } }, { salesCount: sales, id: { lt: BigInt(idStr) } }] }
      }
    }

    const orderBy: Prisma.CourseOrderByWithRelationInput[] =
      sort === 'popular' ? [{ salesCount: 'desc' }, { id: 'desc' }] : [{ id: 'desc' }]

    const items = await prisma.course.findMany({
      where: { AND: [where, cursorWhere] },
      orderBy,
      take: limit,
      include: cardInclude,
    })
    const last = items[items.length - 1]
    const nextCursor =
      items.length === limit && last ? (sort === 'popular' ? `${last.salesCount}_${last.id}` : last.id.toString()) : null
    ok(res, { items: items.map(toMarketCard), nextCursor })
  }),
)

// 코스 구매 — 무료는 즉시 이용권, 유료는 PG 결제(미연동 시 503).
marketplaceRouter.post(
  '/marketplace/courses/:id/purchase',
  requireUser,
  h(async (req, res) => {
    const id = parseId(req.params.id)
    const userId = req.userId!
    const course = await prisma.course.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: { id: true, title: true, price: true, authorType: true, authorUserId: true },
    })
    if (!course) throw Errors.notFound('코스')

    // 이미 접근 권한이 있으면(무료/작성자/구매완료) 그대로 반환
    const ent = await courseEntitlement(course, userId)
    if (ent.entitled) {
      return ok(res, { entitled: true, reason: ent.reason, alreadyOwned: ent.reason !== 'FREE' })
    }

    // 유료 코스 결제
    if (!isPaymentEnabled()) throw Errors.notConfigured('결제(PG)')

    // portone 모드: 클라이언트가 결제 후 받은 paymentId를 받아 서버가 검증
    const paymentId = typeof (req.body as { paymentId?: unknown })?.paymentId === 'string' ? (req.body as { paymentId: string }).paymentId : undefined

    // PENDING 행 확보(재시도 멱등)
    await prisma.coursePurchase.upsert({
      where: { courseId_userId: { courseId: id, userId } },
      update: {},
      create: { courseId: id, userId, price: course.price, status: 'PENDING' },
    })

    const result = await charge({
      amount: course.price,
      courseId: id.toString(),
      userId: userId.toString(),
      description: `여행팩 구매: ${course.title}`,
      paymentId,
    })

    if (!result.ok) {
      throw Errors.conflict('PAYMENT_FAILED', '결제에 실패했습니다', { reason: result.failureReason })
    }

    const [purchase] = await prisma.$transaction([
      prisma.coursePurchase.update({
        where: { courseId_userId: { courseId: id, userId } },
        data: { status: 'PAID', provider: result.provider, paymentId: result.paymentId, purchasedAt: new Date() },
      }),
      prisma.course.update({ where: { id }, data: { salesCount: { increment: 1 } } }),
    ])

    ok(res, {
      entitled: true,
      reason: 'PURCHASED',
      purchase: { id: purchase.id, courseId: id, price: purchase.price, status: purchase.status, purchasedAt: purchase.purchasedAt },
      settlement: settlement(course.price),
    })
  }),
)

// 내가 구매한 코스(이용권) 목록
marketplaceRouter.get(
  '/me/purchases',
  requireUser,
  h(async (req, res) => {
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>)
    const purchases = await prisma.coursePurchase.findMany({
      where: { userId: req.userId!, status: 'PAID', ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
      include: { course: { include: cardInclude } },
    })
    ok(res, {
      items: purchases.map((p) => ({
        purchaseId: p.id,
        price: p.price,
        purchasedAt: p.purchasedAt,
        course: toMarketCard(p.course),
      })),
      nextCursor: nextCursorOf(purchases, limit),
    })
  }),
)

// PortOne 결제 웹훅 — 클라이언트 응답 유실 대비 서버-서버 확정(멱등 보강).
// 서명은 웹훅 시크릿으로 검증. 미설정이면 200 ack만 하고 무시(재시도 폭주 방지).
marketplaceRouter.post(
  '/marketplace/payments/webhook',
  h(async (req, res) => {
    const secret = process.env.PORTONE_WEBHOOK_SECRET ?? env.PORTONE_WEBHOOK_SECRET
    if (!secret) return ok(res, { skipped: true })

    const raw = (req as { rawBody?: Buffer }).rawBody
    const signature = (req.headers['webhook-signature'] || req.headers['x-portone-signature']) as string | undefined
    if (!raw || !signature) throw Errors.badRequest('WEBHOOK_BAD_REQUEST', '서명 또는 본문이 없습니다')

    // HMAC-SHA256(base64) 대조 — 실연동 시 PortOne 서명 규격에 맞춰 헤더/인코딩 확정
    const expected = createHmac('sha256', secret).update(raw).digest('base64')
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw Errors.forbidden('웹훅 서명이 올바르지 않습니다')

    const body = req.body as { type?: string; data?: { paymentId?: string } }
    const paymentId = body.data?.paymentId
    if (paymentId) {
      const purchase = await prisma.coursePurchase.findFirst({ where: { paymentId } })
      if (purchase && purchase.status === 'PENDING') {
        await prisma.$transaction([
          prisma.coursePurchase.update({ where: { id: purchase.id }, data: { status: 'PAID', purchasedAt: new Date() } }),
          prisma.course.update({ where: { id: purchase.courseId }, data: { salesCount: { increment: 1 } } }),
        ])
      }
    }
    ok(res, { received: true })
  }),
)
