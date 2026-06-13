import { Router } from 'express'
import { z } from 'zod'
import { Prisma, TripStatus, VisitStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { Errors } from '../../lib/errors.js'
import { created, h, noContent, ok } from '../../lib/respond.js'
import { validateBody } from '../../middleware/validate.js'
import { requireUser } from '../../middleware/auth.js'
import { nextCursorOf, parseId, parsePage } from '../../lib/util.js'
import { distanceToSpotMeters, resolveCheckinRadius, writeCheckinLocation } from '../../lib/geo.js'
import { courseEntitlement } from '../marketplace/entitlement.js'

export const tripsRouter = Router()

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')

const tripInclude = {
  course: { select: { id: true, title: true, coverImageUrl: true, durationDays: true, region: { select: { name: true } } } },
  visits: {
    include: {
      courseItem: {
        include: { spot: { select: { id: true, name: true, category: true, lat: true, lng: true } } },
      },
    },
  },
} satisfies Prisma.TripInclude

type TripFull = Prisma.TripGetPayload<{ include: typeof tripInclude }>

function sortVisits(trip: TripFull) {
  return [...trip.visits].sort(
    (a, b) => a.courseItem.dayNo - b.courseItem.dayNo || a.courseItem.sortOrder - b.courseItem.sortOrder,
  )
}

function progressOf(trip: TripFull) {
  const total = trip.visits.length
  const done = trip.visits.filter((v) => v.status === 'DONE').length
  const skipped = trip.visits.filter((v) => v.status === 'SKIPPED').length
  return { done, skipped, total }
}

function nextVisitOf(trip: TripFull) {
  const next = sortVisits(trip).find((v) => v.status === 'PENDING')
  return next ? serializeVisit(next) : null
}

function serializeVisit(v: TripFull['visits'][number]) {
  return {
    id: v.id,
    status: v.status,
    checkedInAt: v.checkedInAt,
    checkinType: v.checkinType,
    dayNo: v.courseItem.dayNo,
    order: v.courseItem.sortOrder,
    stayMinutes: v.courseItem.stayMinutes,
    transportToNext: v.courseItem.transportToNext,
    transportMinutes: v.courseItem.transportMinutes,
    spot: v.courseItem.spot,
  }
}

function serializeTrip(trip: TripFull) {
  return {
    id: trip.id,
    status: trip.status,
    startDate: trip.startDate.toISOString().slice(0, 10),
    endDate: trip.endDate.toISOString().slice(0, 10),
    course: {
      id: trip.course.id,
      title: trip.course.title,
      cover: trip.course.coverImageUrl,
      region: trip.course.region.name,
      durationDays: trip.course.durationDays,
    },
    progress: progressOf(trip),
    visits: sortVisits(trip).map(serializeVisit),
  }
}

async function getOwnedTrip(tripId: bigint, userId: bigint): Promise<TripFull> {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId }, include: tripInclude })
  if (!trip) throw Errors.notFound('여행')
  return trip
}

tripsRouter.post(
  '/trips',
  requireUser,
  validateBody(z.object({ courseId: z.coerce.bigint(), startDate: dateSchema })),
  h(async (req, res) => {
    const { courseId, startDate } = req.body as { courseId: bigint; startDate: string }
    const course = await prisma.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED' },
      include: { items: { select: { id: true } } },
    })
    if (!course) throw Errors.notFound('코스')
    if (course.items.length === 0) throw Errors.conflict('COURSE_EMPTY', '구성 스팟이 없는 코스입니다')

    // 유료 코스는 구매(이용권) 후에만 여행 시작 가능 — 페이월 우회 방지
    const ent = await courseEntitlement(course, req.userId!)
    if (!ent.entitled) throw Errors.forbidden('구매 후 이용할 수 있는 유료 코스입니다')

    const start = new Date(`${startDate}T00:00:00Z`)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + course.durationDays - 1)

    const trip = await prisma.trip.create({
      data: {
        userId: req.userId!,
        courseId,
        startDate: start,
        endDate: end,
        visits: { create: course.items.map((item) => ({ courseItemId: item.id })) },
      },
    })
    const full = await getOwnedTrip(trip.id, req.userId!)
    created(res, serializeTrip(full))
  }),
)

tripsRouter.get(
  '/trips/me',
  requireUser,
  h(async (req, res) => {
    const { cursor, limit } = parsePage(req.query as Record<string, unknown>)
    const status = typeof req.query.status === 'string' && req.query.status in TripStatus ? (req.query.status as TripStatus) : undefined
    const trips = await prisma.trip.findMany({
      where: { userId: req.userId!, ...(status ? { status } : {}), ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
      include: tripInclude,
    })
    ok(res, { items: trips.map(serializeTrip), nextCursor: nextCursorOf(trips, limit) })
  }),
)

tripsRouter.get(
  '/trips/:tripId',
  requireUser,
  h(async (req, res) => {
    const trip = await getOwnedTrip(parseId(req.params.tripId, 'tripId'), req.userId!)
    ok(res, { ...serializeTrip(trip), nextVisit: nextVisitOf(trip) })
  }),
)

tripsRouter.patch(
  '/trips/:tripId',
  requireUser,
  validateBody(z.object({ startDate: dateSchema.optional(), status: z.enum(['ONGOING', 'COMPLETED', 'CANCELED']).optional() })),
  h(async (req, res) => {
    const trip = await getOwnedTrip(parseId(req.params.tripId, 'tripId'), req.userId!)
    const body = req.body as { startDate?: string; status?: 'ONGOING' | 'COMPLETED' | 'CANCELED' }
    const data: Prisma.TripUpdateInput = {}

    if (body.startDate) {
      if (trip.status !== 'UPCOMING') throw Errors.conflict('TRIP_DATE_LOCKED', '시작 전 여행만 날짜를 바꿀 수 있습니다')
      const start = new Date(`${body.startDate}T00:00:00Z`)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + trip.course.durationDays - 1)
      data.startDate = start
      data.endDate = end
    }

    if (body.status) {
      const allowed: Record<string, TripStatus[]> = {
        ONGOING: ['UPCOMING'],
        COMPLETED: ['ONGOING'],
        CANCELED: ['UPCOMING', 'ONGOING'],
      }
      if (!allowed[body.status]!.includes(trip.status)) {
        throw Errors.conflict('TRIP_INVALID_TRANSITION', `${trip.status} 상태에서 ${body.status}(으)로 바꿀 수 없습니다`)
      }
      data.status = body.status
    }

    await prisma.trip.update({ where: { id: trip.id }, data })
    ok(res, serializeTrip(await getOwnedTrip(trip.id, req.userId!)))
  }),
)

tripsRouter.post(
  '/trips/:tripId/visits/:visitId/check-in',
  requireUser,
  validateBody(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().optional(), force: z.boolean().optional() })),
  h(async (req, res) => {
    const trip = await getOwnedTrip(parseId(req.params.tripId, 'tripId'), req.userId!)
    const visitId = parseId(req.params.visitId, 'visitId')
    const { lat, lng, force } = req.body as { lat: number; lng: number; force?: boolean }

    // 시작일이 됐는데 아직 UPCOMING이면 체크인과 함께 자동 시작
    let status = trip.status
    if (status === 'UPCOMING' && trip.startDate <= new Date()) {
      await prisma.trip.update({ where: { id: trip.id }, data: { status: 'ONGOING' } })
      status = 'ONGOING'
    }
    if (status !== 'ONGOING') throw Errors.conflict('TRIP_NOT_ONGOING', '진행 중인 여행에서만 체크인할 수 있습니다')

    const visit = trip.visits.find((v) => v.id === visitId)
    if (!visit) throw Errors.notFound('방문 항목')
    if (visit.status !== 'PENDING') throw Errors.conflict('VISIT_ALREADY_DONE', '이미 처리된 방문입니다')

    const spot = await prisma.spot.findUniqueOrThrow({
      where: { id: visit.courseItem.spot.id },
      select: { checkinRadiusM: true, category: true },
    })
    const radiusM = resolveCheckinRadius(spot)
    const distanceM = await distanceToSpotMeters(visit.courseItem.spot.id, lat, lng)
    const within = distanceM <= radiusM

    if (!within && !force) {
      throw Errors.conflict('CHECKIN_OUT_OF_RANGE', '아직 도착 전이에요', { distanceM: Math.round(distanceM), radiusM })
    }

    // 반경 밖 강제 체크인은 MANUAL로 구분 저장 (기획설계서 6.2 결정 3)
    await prisma.tripVisit.update({
      where: { id: visitId },
      data: { status: 'DONE', checkedInAt: new Date(), checkinType: within ? 'VERIFIED' : 'MANUAL' },
    })
    await writeCheckinLocation(visitId, lat, lng)

    const updated = await getOwnedTrip(trip.id, req.userId!)
    if (!updated.visits.some((v) => v.status === 'PENDING')) {
      await prisma.trip.update({ where: { id: trip.id }, data: { status: 'COMPLETED' } })
    }
    const final = await getOwnedTrip(trip.id, req.userId!)
    const checkedVisit = final.visits.find((v) => v.id === visitId)!
    ok(res, { visit: serializeVisit(checkedVisit), progress: progressOf(final), nextVisit: nextVisitOf(final), tripStatus: final.status })
  }),
)

tripsRouter.post(
  '/trips/:tripId/visits/:visitId/skip',
  requireUser,
  validateBody(z.object({ reasonCode: z.string().max(50).optional() }).optional().default({})),
  h(async (req, res) => {
    const trip = await getOwnedTrip(parseId(req.params.tripId, 'tripId'), req.userId!)
    const visitId = parseId(req.params.visitId, 'visitId')
    const visit = trip.visits.find((v) => v.id === visitId)
    if (!visit) throw Errors.notFound('방문 항목')
    if (visit.status !== VisitStatus.PENDING) throw Errors.conflict('VISIT_ALREADY_DONE', '이미 처리된 방문입니다')

    await prisma.tripVisit.update({ where: { id: visitId }, data: { status: 'SKIPPED' } })
    const updated = await getOwnedTrip(trip.id, req.userId!)
    if (!updated.visits.some((v) => v.status === 'PENDING')) {
      await prisma.trip.update({ where: { id: trip.id }, data: { status: 'COMPLETED' } })
    }
    const final = await getOwnedTrip(trip.id, req.userId!)
    ok(res, { visit: serializeVisit(final.visits.find((v) => v.id === visitId)!), nextVisit: nextVisitOf(final), tripStatus: final.status })
  }),
)

tripsRouter.delete(
  '/trips/:tripId',
  requireUser,
  h(async (req, res) => {
    const trip = await getOwnedTrip(parseId(req.params.tripId, 'tripId'), req.userId!)
    await prisma.trip.delete({ where: { id: trip.id } })
    noContent(res)
  }),
)
