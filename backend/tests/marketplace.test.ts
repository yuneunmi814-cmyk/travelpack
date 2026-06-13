import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { api, seedAll, signupUser, adminToken } from './helpers.js'
import type { SeedResult } from '../prisma/seed-core.js'
import { setPaymentTransportForTest, mockApproveTransport, paymentMode, isPaymentEnabled, settlement } from '../src/modules/marketplace/payment.js'

let seed: SeedResult
const today = new Date().toISOString().slice(0, 10)

// 크리에이터가 코스를 만들 때 쓸 공통 본문 빌더
function courseBody(over: Record<string, unknown> = {}) {
  return {
    title: '나만의 제주 동부 1박2일',
    regionId: seed.regionId.toString(),
    summary: '현지인 노하우가 담긴 코스',
    durationDays: 2,
    price: 0,
    themeIds: [seed.themeIds['힐링']!.toString()],
    items: [
      { dayNo: 1, sortOrder: 1, spotId: seed.spotIds['성산일출봉']!.toString(), stayMinutes: 90, transportToNext: 'BUS', transportMinutes: 20 },
      { dayNo: 1, sortOrder: 2, spotId: seed.spotIds['광치기 해변']!.toString(), stayMinutes: 40 },
      { dayNo: 2, sortOrder: 1, spotId: seed.spotIds['비자림']!.toString(), stayMinutes: 80 },
    ],
    ...over,
  }
}

/** 크리에이터 코스를 만들고 검수요청 → 관리자 발행까지 끝낸 published 코스 id 반환. */
async function publishCreatorCourse(authorToken: string, over: Record<string, unknown> = {}): Promise<string> {
  const create = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${authorToken}`).send(courseBody(over))
  if (create.status !== 201) throw new Error(`create failed: ${create.status} ${JSON.stringify(create.body)}`)
  const courseId = create.body.data.id
  await api.post(`/api/v1/me/courses/${courseId}/submit`).set('Authorization', `Bearer ${authorToken}`)
  const reviewer = await adminToken(seed.admins.reviewer, 'CONTENT_MANAGER')
  const pub = await api.post(`/api/v1/admin/courses/${courseId}/publish`).set('Authorization', `Bearer ${reviewer}`)
  if (pub.status !== 200) throw new Error(`publish failed: ${pub.status} ${JSON.stringify(pub.body)}`)
  return courseId
}

describe('크리에이터 코스 authoring (마켓플레이스 7장)', () => {
  let token: string
  beforeAll(async () => {
    seed = await seedAll()
    token = (await signupUser()).accessToken
  })

  it('코스 생성 → DRAFT + authorType USER', async () => {
    const res = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${token}`).send(courseBody())
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.editable).toBe(true)
    expect(res.body.data.days.length).toBe(2)
    expect(res.body.data.spotCount).toBe(3)
  })

  it('비로그인 작성 차단 (결정 4)', async () => {
    const res = await api.post('/api/v1/me/courses').send(courseBody())
    expect(res.status).toBe(401)
  })

  it('존재하지 않는 스팟 포함 → 400', async () => {
    const res = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${token}`)
      .send(courseBody({ items: [{ dayNo: 1, sortOrder: 1, spotId: '99999999' }] }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('SPOT_NOT_FOUND')
  })

  it('여행기간을 벗어난 일자 → 400', async () => {
    const res = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${token}`)
      .send(courseBody({ durationDays: 1, items: [{ dayNo: 2, sortOrder: 1, spotId: seed.spotIds['비자림']!.toString() }] }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('ITEM_DAY_OUT_OF_RANGE')
  })

  it('같은 일자 순서 중복 → 400', async () => {
    const res = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${token}`)
      .send(courseBody({ items: [
        { dayNo: 1, sortOrder: 1, spotId: seed.spotIds['성산일출봉']!.toString() },
        { dayNo: 1, sortOrder: 1, spotId: seed.spotIds['비자림']!.toString() },
      ] }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('ITEM_DUPLICATE_ORDER')
  })

  it('내 코스 목록·상세·수정(DRAFT)·검수요청·회수 플로', async () => {
    const create = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${token}`).send(courseBody())
    const id = create.body.data.id

    const list = await api.get('/api/v1/me/courses').set('Authorization', `Bearer ${token}`)
    expect(list.body.data.items.some((c: { id: string }) => c.id === id)).toBe(true)

    const upd = await api.put(`/api/v1/me/courses/${id}`).set('Authorization', `Bearer ${token}`)
      .send(courseBody({ title: '수정된 제목', price: 5000 }))
    expect(upd.status).toBe(200)
    expect(upd.body.data.title).toBe('수정된 제목')
    expect(upd.body.data.price).toBe(5000)

    const submit = await api.post(`/api/v1/me/courses/${id}/submit`).set('Authorization', `Bearer ${token}`)
    expect(submit.status).toBe(200)
    expect(submit.body.data.status).toBe('IN_REVIEW')

    // 검수 중에는 수정 불가
    const lockEdit = await api.put(`/api/v1/me/courses/${id}`).set('Authorization', `Bearer ${token}`).send(courseBody())
    expect(lockEdit.status).toBe(409)
    expect(lockEdit.body.error.code).toBe('COURSE_NOT_EDITABLE')

    // 회수 → 다시 DRAFT
    const withdraw = await api.post(`/api/v1/me/courses/${id}/withdraw`).set('Authorization', `Bearer ${token}`)
    expect(withdraw.body.data.status).toBe('DRAFT')
  })

  it('타인의 코스는 조회·수정 불가 (404)', async () => {
    const create = await api.post('/api/v1/me/courses').set('Authorization', `Bearer ${token}`).send(courseBody())
    const id = create.body.data.id
    const other = (await signupUser()).accessToken
    const get = await api.get(`/api/v1/me/courses/${id}`).set('Authorization', `Bearer ${other}`)
    expect(get.status).toBe(404)
  })
})

describe('마켓플레이스 발행·노출', () => {
  let authorToken: string
  beforeAll(async () => {
    seed = await seedAll()
    authorToken = (await signupUser()).accessToken
  })

  it('검수요청 → 관리자 4-eyes 발행 → 마켓 목록 노출', async () => {
    const courseId = await publishCreatorCourse(authorToken, { price: 9900 })
    const list = await api.get('/api/v1/marketplace/courses?sort=latest')
    const found = list.body.data.items.find((c: { id: string }) => c.id === courseId)
    expect(found).toBeTruthy()
    expect(found.price).toBe(9900)
    expect(found.author?.nickname).toBeTruthy()
  })

  it('무료 정렬은 유료 코스를 제외', async () => {
    await publishCreatorCourse(authorToken, { price: 0, title: '무료 나눔 코스' })
    const free = await api.get('/api/v1/marketplace/courses?sort=free')
    expect(free.body.data.items.every((c: { price: number }) => c.price === 0)).toBe(true)
  })
})

describe('이용권·구매 (페이월)', () => {
  let authorToken: string
  let buyerToken: string
  let paidCourseId: string

  beforeAll(async () => {
    seed = await seedAll()
    authorToken = (await signupUser()).accessToken
    buyerToken = (await signupUser()).accessToken
    paidCourseId = await publishCreatorCourse(authorToken, { price: 12000 })
  })

  it('유료 코스 미구매자는 1일차 미리보기만(잠금)', async () => {
    const res = await api.get(`/api/v1/courses/${paidCourseId}`).set('Authorization', `Bearer ${buyerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.locked).toBe(true)
    expect(res.body.data.entitlementReason).toBe('LOCKED')
    expect(res.body.data.price).toBe(12000)
    expect(res.body.data.days.length).toBe(1) // 1일차만
    expect(res.body.data.days[0].items[0].spot.lat).toBeUndefined() // 좌표 잠금
  })

  it('작성자 본인은 잠금 없이 전체 열람', async () => {
    const res = await api.get(`/api/v1/courses/${paidCourseId}`).set('Authorization', `Bearer ${authorToken}`)
    expect(res.body.data.locked).toBe(false)
    expect(res.body.data.entitlementReason).toBe('AUTHOR')
    expect(res.body.data.days.length).toBe(2)
  })

  it('미구매자는 유료 코스로 여행 시작 불가 (403)', async () => {
    const res = await api.post('/api/v1/trips').set('Authorization', `Bearer ${buyerToken}`)
      .send({ courseId: paidCourseId, startDate: today })
    expect(res.status).toBe(403)
  })

  it('PG 미설정 시 유료 구매는 503', async () => {
    const res = await api.post(`/api/v1/marketplace/courses/${paidCourseId}/purchase`).set('Authorization', `Bearer ${buyerToken}`)
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('NOT_CONFIGURED')
  })

  describe('PG 연동(mock) 시', () => {
    beforeAll(() => {
      process.env.PG_PROVIDER = 'mock'
      process.env.PG_API_SECRET = 'test-secret'
      setPaymentTransportForTest(mockApproveTransport())
    })
    afterAll(() => {
      delete process.env.PG_PROVIDER
      delete process.env.PG_API_SECRET
    })

    it('구매 성공 → PAID 이용권 + 정산 분배 + salesCount 증가', async () => {
      const res = await api.post(`/api/v1/marketplace/courses/${paidCourseId}/purchase`).set('Authorization', `Bearer ${buyerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.entitled).toBe(true)
      expect(res.body.data.reason).toBe('PURCHASED')
      expect(res.body.data.purchase.status).toBe('PAID')
      // 기본 수수료 20% → 크리에이터 9,600 / 플랫폼 2,400
      expect(res.body.data.settlement.platformFee).toBe(2400)
      expect(res.body.data.settlement.creatorPayout).toBe(9600)
    })

    it('구매 후 상세 잠금 해제 + 전체 일자 노출', async () => {
      const res = await api.get(`/api/v1/courses/${paidCourseId}`).set('Authorization', `Bearer ${buyerToken}`)
      expect(res.body.data.locked).toBe(false)
      expect(res.body.data.entitlementReason).toBe('PURCHASED')
      expect(res.body.data.days.length).toBe(2)
      expect(res.body.data.days[0].items[0].spot.lat).toBeDefined()
    })

    it('중복 구매는 alreadyOwned로 멱등 처리', async () => {
      const res = await api.post(`/api/v1/marketplace/courses/${paidCourseId}/purchase`).set('Authorization', `Bearer ${buyerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.alreadyOwned).toBe(true)
    })

    it('내 구매 목록에 노출', async () => {
      const res = await api.get('/api/v1/me/purchases').set('Authorization', `Bearer ${buyerToken}`)
      expect(res.body.data.items.some((p: { course: { id: string } }) => p.course.id === paidCourseId)).toBe(true)
    })

    it('구매자는 유료 코스로 여행 시작 가능', async () => {
      const res = await api.post('/api/v1/trips').set('Authorization', `Bearer ${buyerToken}`)
        .send({ courseId: paidCourseId, startDate: today })
      expect(res.status).toBe(201)
    })

    it('관리자 정산 대시보드에 크리에이터 매출·지급액 집계', async () => {
      const opsToken = await adminToken(seed.admins.super, 'OPERATION_MANAGER')
      const res = await api.get('/api/v1/admin/marketplace/settlements').set('Authorization', `Bearer ${opsToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.summary.grossRevenue).toBeGreaterThanOrEqual(12000)
      expect(res.body.data.summary.feePercent).toBe(20)
      const creator = res.body.data.creators.find((c: { gross: number }) => c.gross >= 12000)
      expect(creator).toBeTruthy()
      expect(creator.payout).toBe(creator.gross - creator.platformFee)
    })

    it('구매 실패(PG 거절)는 409 PAYMENT_FAILED, 이용권 미부여', async () => {
      setPaymentTransportForTest(async () => ({ ok: false, paymentId: '', provider: 'mock', failureReason: 'CARD_DECLINED' }))
      const newBuyer = (await signupUser()).accessToken
      const res = await api.post(`/api/v1/marketplace/courses/${paidCourseId}/purchase`).set('Authorization', `Bearer ${newBuyer}`)
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('PAYMENT_FAILED')
      const detail = await api.get(`/api/v1/courses/${paidCourseId}`).set('Authorization', `Bearer ${newBuyer}`)
      expect(detail.body.data.locked).toBe(true)
    })
  })

  it('무료 코스는 결제 없이 즉시 이용권', async () => {
    const freeId = await publishCreatorCourse(authorToken, { price: 0, title: '무료 코스' })
    const buyer = (await signupUser()).accessToken
    const res = await api.post(`/api/v1/marketplace/courses/${freeId}/purchase`).set('Authorization', `Bearer ${buyer}`)
    expect(res.status).toBe(200)
    expect(res.body.data.entitled).toBe(true)
    expect(res.body.data.reason).toBe('FREE')
  })
})

describe('결제 모드 판정(게이팅)', () => {
  afterEach(() => {
    delete process.env.PG_PROVIDER
    delete process.env.PG_API_SECRET
  })

  it('미설정이면 off → 유료 구매 비활성', () => {
    expect(paymentMode()).toBe('off')
    expect(isPaymentEnabled()).toBe(false)
  })

  it('mock 모드는 시크릿 없이도 켜짐(개발/체험용)', () => {
    process.env.PG_PROVIDER = 'mock'
    expect(paymentMode()).toBe('mock')
    expect(isPaymentEnabled()).toBe(true)
  })

  it('portone은 시크릿이 있어야 켜짐', () => {
    process.env.PG_PROVIDER = 'portone'
    expect(isPaymentEnabled()).toBe(false)
    process.env.PG_API_SECRET = 'secret'
    expect(paymentMode()).toBe('portone')
  })

  it('정산 분배는 수수료율대로 내림 계산', () => {
    expect(settlement(10000)).toMatchObject({ platformFee: 2000, creatorPayout: 8000, feePercent: 20 })
    expect(settlement(9999).platformFee).toBe(1999) // floor
  })
})
