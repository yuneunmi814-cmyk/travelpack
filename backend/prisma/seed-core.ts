import { readFileSync } from 'node:fs'
import type { Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// 공공데이터 관광 3종(반려동물·무장애·연관관광지) — sync:tourism 결과를 시드에 구워둠(이름 매칭, 라이브 API 없이 재현)
interface TourismSeed { tourapiContentId: string | null; petInfo: unknown; barrierFree: unknown; relatedSpots: unknown; petFriendly: boolean; hasBarrierFree: boolean }
const TOURISM_SEED: Record<string, TourismSeed> =
  JSON.parse(readFileSync(new URL('./seed-tourism.json', import.meta.url), 'utf8'))

// 한국관광공사 TourAPI 여행코스 import 결과(sync:tourapi --courses) — 경유지 스팟 + 실제 추천코스를 시드에 구워둠
interface KtoCourseItem { dayNo: number | null; sortOrder: number | null; spotCid: string; stayMinutes: number | null; transportToNext: string | null; transportMinutes: number | null }
interface KtoSeed {
  spots: { cid: string; name: string; category: string | null; lat: number; lng: number; regionSlug: string; image: string | null }[]
  courses: { cid: string; regionSlug: string; title: string; summary: string | null; durationDays: number | null; estCost: number | null; cover: string | null; items: KtoCourseItem[] | null }[]
}
const KTO_SEED: KtoSeed = JSON.parse(readFileSync(new URL('./seed-courses.json', import.meta.url), 'utf8'))

// 유튜브 여행영상(sync:youtube 결과) — 지역별 영상 + buzzScore를 시드에 구워둠(라이브 API 없이 재현)
interface VideoSeed {
  buzz: Record<string, number>
  videos: { youtubeId: string; regionSlug: string; title: string; channelTitle: string | null; thumbnailUrl: string | null; viewCount: string; publishedAt: string | null; durationSec: number | null; sortOrder: number }[]
}
const VIDEO_SEED: VideoSeed = JSON.parse(readFileSync(new URL('./seed-videos.json', import.meta.url), 'utf8'))

// KTO 코스 제목/요약 키워드로 테마(8종 중 1~2개) 추론 — 홈 테마섹션·추천 노출용
function inferKtoThemes(text: string): string[] {
  const picks: string[] = []
  if (/역사|유적|한옥|궁궐?|능|서원|사찰|사찰|절|향교|전통|문화재|박물관|미술|신라|백제|종묘|사직|읍성|왕릉|고분|이성계|조선|고풍|유산/.test(text)) picks.push('역사')
  if (/시장|맛집|먹거리|미식|음식|밥상|빵|먹는|별미|이열치열|먹방/.test(text)) picks.push('미식')
  if (/카페|커피|디저트/.test(text)) picks.push('카페')
  if (/야경|야시장|불빛|전망|포토|핫플|인생샷/.test(text)) picks.push('야경')
  if (/바다|해변|해수욕|섬|항|포구|등대|해안|산\b|숲|공원|계곡|호수|호반|폭포|오름|수목원|정원|둘레길|올레|해파랑|남파랑|마실길|국도|풀밭|자연/.test(text)) picks.push('자연')
  if (/체험|레저|액티비티|놀이|짚라인|서핑|배타고|영화|축제|레일바이크|드라이브/.test(text)) picks.push('액티비티')
  if (picks.length === 0) picks.push('힐링')
  return [...new Set(picks)].slice(0, 2)
}

// 전국 지역 대표 관광지(한국관광공사 TourAPI) — npm run db:seed 시 옵션으로 적재
interface RegionSpot { name: string; category: string; lat: number; lng: number; image: string }
const REGION_SEED: { jejuExtraImages: Record<string, string | null>; regions: Record<string, RegionSpot[]> } =
  JSON.parse(readFileSync(new URL('./seed-regions.json', import.meta.url), 'utf8'))
const REGION_KO: Record<string, string> = { busan: '부산', gyeongju: '경주', yeosu: '여수', gangneung: '강릉', jeonju: '전주', seoul: '서울', incheon: '인천', daegu: '대구', daejeon: '대전', gwangju: '광주', sokcho: '속초', ulsan: '울산', sejong: '세종', suwon: '수원', chuncheon: '춘천', cheongju: '청주', tongyeong: '통영', andong: '안동', suncheon: '순천', gunsan: '군산', pohang: '포항', gongju: '공주' }

export interface SeedResult {
  regionId: bigint
  themeIds: Record<string, bigint>
  spotIds: Record<string, bigint>
  publishedCourseId: bigint
  draftCourseId: bigint
  admins: { super: bigint; editor: bigint; reviewer: bigint }
}

const SPOTS = [
  { name: '성산일출봉', category: '자연', lat: 33.4587, lng: 126.9425, stay: 90, fee: '성인 5,000원', tips: '오후 4시 이후 방문하면 줄이 짧고, 광치기 해변 노을과 이어 보기 좋아요', summary: '유네스코 세계자연유산, 분화구 일출 명소', open: { mon: { open: '07:00', close: '19:00' }, tue: { open: '07:00', close: '19:00' }, wed: { open: '07:00', close: '19:00' }, thu: { open: '07:00', close: '19:00' }, fri: { open: '07:00', close: '19:00' }, sat: { open: '07:00', close: '19:00' }, sun: { open: '07:00', close: '19:00' } } },
  { name: '광치기 해변', category: '해변', lat: 33.4503, lng: 126.9197, stay: 40, fee: '무료', tips: '물때를 맞춰 가면 이끼 낀 용암 지대를 볼 수 있어요', summary: '성산일출봉을 배경으로 한 인생샷 명소' },
  { name: '섭지코지', category: '자연', lat: 33.4239, lng: 126.9296, stay: 60, fee: '무료(주차 유료)', tips: '유채꽃 시즌(3~4월)이 가장 아름다워요', summary: '해안 절벽 산책로와 등대' },
  { name: '함덕해수욕장', category: '해변', lat: 33.5434, lng: 126.6692, stay: 80, fee: '무료', tips: '에메랄드빛 물색은 오전이 제일 선명해요', summary: '서우봉과 맞닿은 에메랄드 해변' },
  { name: '비자림', category: '숲', lat: 33.4894, lng: 126.8085, stay: 80, fee: '성인 3,000원', tips: '돌멩이 길이라 운동화 필수, 우천 시 더 운치 있어요', summary: '천년 비자나무 숲 치유 산책로' },
  { name: '만장굴', category: '동굴', lat: 33.5283, lng: 126.7706, stay: 60, fee: '성인 4,000원', tips: '내부는 한여름에도 서늘하니 겉옷을 챙기세요', summary: '세계 최장급 용암동굴' },
  { name: '월정리 해변', category: '해변', lat: 33.556, lng: 126.7958, stay: 90, fee: '무료', tips: '카페거리와 함께 묶어 반나절 코스로 좋아요', summary: '카페거리로 유명한 백사장 해변' },
  { name: '동문재래시장', category: '시장', lat: 33.5121, lng: 126.5281, stay: 90, fee: '무료', tips: '야시장은 18시 이후! 딱새우회·흑돼지 꼬치 추천', summary: '제주 최대 전통시장, 야시장 먹거리' },
] as const

// 대표 관광사진 (한국관광공사 TourAPI firstimage/detailImage2). 출처 표기 필수 → sourceCredit
const SPOT_IMAGES: Record<string, string> = {
  '성산일출봉': 'https://tong.visitkorea.or.kr/cms/resource/93/1876193_image2_1.jpg',
  '광치기 해변': 'https://tong.visitkorea.or.kr/cms/resource/75/3400775_image2_1.jpg',
  '함덕해수욕장': 'https://tong.visitkorea.or.kr/cms/resource/00/3354600_image2_1.jpg',
  '월정리 해변': 'https://tong.visitkorea.or.kr/cms/resource/36/3011836_image2_1.jpg',
  '동문재래시장': 'https://tong.visitkorea.or.kr/cms/resource/38/2678438_image2_1.jpg',
}
// 추가로 확보된 제주 대표사진(섭지코지·비자림·만장굴 등)이 있으면 병합
for (const [k, v] of Object.entries(REGION_SEED.jejuExtraImages)) if (v) SPOT_IMAGES[k] = v

export async function runSeed(prisma: PrismaClient, adminPassword: string, rounds = 10, opts: { regions?: boolean } = {}): Promise<SeedResult> {
  // 의존 역순 전체 삭제 (개발·테스트 시드 전용)
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.reviewReport.deleteMany(),
    prisma.reviewImage.deleteMany(),
    prisma.review.deleteMany(),
    prisma.tripVisit.deleteMany(),
    prisma.trip.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.courseItem.deleteMany(),
    prisma.courseTheme.deleteMany(),
    prisma.course.deleteMany(),
    prisma.video.deleteMany(),
    prisma.spotImage.deleteMany(),
    prisma.spot.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.userPushToken.deleteMany(),
    prisma.userInterest.deleteMany(),
    prisma.userConsent.deleteMany(),
    prisma.user.deleteMany(),
    prisma.adminUser.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.region.deleteMany(),
  ])

  const passwordHash = await bcrypt.hash(adminPassword, rounds)
  const [superAdmin, editor, reviewer] = await Promise.all([
    prisma.adminUser.create({ data: { email: 'super@travelpack.app', passwordHash, name: '총괄 관리자', role: 'SUPER_ADMIN' } }),
    prisma.adminUser.create({ data: { email: 'editor@travelpack.app', passwordHash, name: '콘텐츠 에디터', role: 'CONTENT_MANAGER' } }),
    prisma.adminUser.create({ data: { email: 'reviewer@travelpack.app', passwordHash, name: '콘텐츠 검수자', role: 'CONTENT_MANAGER' } }),
  ])

  const jeju = await prisma.region.create({ data: { name: '제주', slug: 'jeju', sortOrder: 1, thumbnailUrl: SPOT_IMAGES['성산일출봉'] } })
  await prisma.region.createMany({
    data: [
      { name: '부산', slug: 'busan', sortOrder: 2 },
      { name: '경주', slug: 'gyeongju', sortOrder: 3 },
      { name: '여수', slug: 'yeosu', sortOrder: 4 },
      { name: '강릉', slug: 'gangneung', sortOrder: 5 },
      { name: '전주', slug: 'jeonju', sortOrder: 6 },
      { name: '서울', slug: 'seoul', sortOrder: 7 },
      { name: '인천', slug: 'incheon', sortOrder: 8 },
      { name: '대구', slug: 'daegu', sortOrder: 9 },
      { name: '대전', slug: 'daejeon', sortOrder: 10 },
      { name: '광주', slug: 'gwangju', sortOrder: 11 },
      { name: '속초', slug: 'sokcho', sortOrder: 12 },
      { name: '울산', slug: 'ulsan', sortOrder: 13 },
      { name: '세종', slug: 'sejong', sortOrder: 14 },
      { name: '수원', slug: 'suwon', sortOrder: 15 },
      { name: '춘천', slug: 'chuncheon', sortOrder: 16 },
      { name: '청주', slug: 'cheongju', sortOrder: 17 },
      { name: '통영', slug: 'tongyeong', sortOrder: 18 },
      { name: '안동', slug: 'andong', sortOrder: 19 },
      { name: '순천', slug: 'suncheon', sortOrder: 20 },
      { name: '군산', slug: 'gunsan', sortOrder: 21 },
      { name: '포항', slug: 'pohang', sortOrder: 22 },
      { name: '공주', slug: 'gongju', sortOrder: 23 },
    ],
  })

  // 잘 채워지는 테마(자연·힐링·역사·액티비티)를 앞에 둬 비로그인 홈 테마섹션이 풍성하게 보이도록 정렬
  const themeNames = ['자연', '힐링', '역사', '액티비티', '미식', '인생샷', '카페', '야경']
  const themes: Record<string, bigint> = {}
  for (const name of themeNames) {
    themes[name] = (await prisma.theme.create({ data: { name } })).id
  }

  const spotIds: Record<string, bigint> = {}
  for (const s of SPOTS) {
    spotIds[s.name] = (
      await prisma.spot.create({
        data: {
          regionId: jeju.id,
          name: s.name,
          category: s.category,
          summary: s.summary,
          tips: s.tips,
          lat: s.lat,
          lng: s.lng,
          address: `제주특별자치도 ${s.name} 일대`,
          admissionFee: s.fee,
          avgStayMinutes: s.stay,
          openHours: 'open' in s ? (s.open as object) : undefined,
          ...(SPOT_IMAGES[s.name]
            ? { images: { create: [{ url: SPOT_IMAGES[s.name]!, sourceCredit: '한국관광공사', source: 'TOURAPI', sourceId: 'seed', sortOrder: 0 }] } }
            : {}),
        },
      })
    ).id
  }

  // 와이어프레임(CO-01)과 동일한 "제주 동부 힐링 2일" — 명소 8곳
  const published = await prisma.course.create({
    data: {
      regionId: jeju.id,
      title: '제주 동부 힐링 2일',
      summary: '바다·오름·카페를 잇는 2일',
      coverImageUrl: SPOT_IMAGES['성산일출봉'],
      durationDays: 2,
      estCost: 120000,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdBy: editor.id,
      saveCount: 1200,
      themes: { create: [{ themeId: themes['힐링']! }, { themeId: themes['인생샷']! }] },
      items: {
        create: [
          { dayNo: 1, sortOrder: 1, spotId: spotIds['성산일출봉']!, stayMinutes: 90, transportToNext: 'WALK', transportMinutes: 15 },
          { dayNo: 1, sortOrder: 2, spotId: spotIds['광치기 해변']!, stayMinutes: 40, transportToNext: 'BUS', transportMinutes: 30 },
          { dayNo: 1, sortOrder: 3, spotId: spotIds['섭지코지']!, stayMinutes: 60, transportToNext: 'BUS', transportMinutes: 40 },
          { dayNo: 1, sortOrder: 4, spotId: spotIds['함덕해수욕장']!, stayMinutes: 80 },
          { dayNo: 2, sortOrder: 1, spotId: spotIds['비자림']!, stayMinutes: 80, transportToNext: 'BUS', transportMinutes: 35 },
          { dayNo: 2, sortOrder: 2, spotId: spotIds['만장굴']!, stayMinutes: 60, transportToNext: 'BUS', transportMinutes: 25 },
          { dayNo: 2, sortOrder: 3, spotId: spotIds['월정리 해변']!, stayMinutes: 90, transportToNext: 'BUS', transportMinutes: 45 },
          { dayNo: 2, sortOrder: 4, spotId: spotIds['동문재래시장']!, stayMinutes: 90 },
        ],
      },
    },
  })

  const draft = await prisma.course.create({
    data: {
      regionId: jeju.id,
      title: '서쪽 노을 미식 코스',
      summary: '노을 맛집과 미식 스팟을 잇는 1박2일',
      coverImageUrl: SPOT_IMAGES['동문재래시장'],
      durationDays: 2,
      estCost: 150000,
      status: 'DRAFT',
      createdBy: editor.id,
      themes: { create: [{ themeId: themes['미식']! }] },
      items: {
        create: [
          { dayNo: 1, sortOrder: 1, spotId: spotIds['동문재래시장']!, stayMinutes: 90, transportToNext: 'BUS', transportMinutes: 40 },
          { dayNo: 1, sortOrder: 2, spotId: spotIds['함덕해수욕장']!, stayMinutes: 60 },
          { dayNo: 2, sortOrder: 1, spotId: spotIds['월정리 해변']!, stayMinutes: 90 },
        ],
      },
    },
  })

  const now = Date.now()
  await prisma.banner.create({
    data: {
      title: '여름 제주 특집',
      imageUrl: 'https://placehold.co/720x360',
      linkType: 'COURSE',
      linkTarget: published.id.toString(),
      startAt: new Date(now - 86400_000),
      endAt: new Date(now + 30 * 86400_000),
      sortOrder: 1,
    },
  })

  // 전국 지역 대표 관광지 + 지역별 핵심 코스 (db:seed 옵션). 테스트 시드(runSeed 기본)에는 미포함
  if (opts.regions) {
    // 스토어 심사용 데모 계정 (게스트 열람 외 로그인 기능 테스트용)
    await prisma.user.create({
      data: {
        email: 'demo@travelpack.app',
        passwordHash: await bcrypt.hash('travelpack-demo-1234', rounds),
        nickname: '데모여행자',
        provider: 'local',
        consents: {
          create: [
            { consentType: 'TERMS', agreed: true, version: '1.0' },
            { consentType: 'PRIVACY', agreed: true, version: '1.0' },
            { consentType: 'AGE14', agreed: true, version: '1.0' },
          ],
        },
      },
    })

    const rows = await prisma.region.findMany({ where: { slug: { in: Object.keys(REGION_SEED.regions) } } })
    const bySlug = new Map(rows.map((r) => [r.slug, r.id]))
    for (const [slug, spots] of Object.entries(REGION_SEED.regions)) {
      const regionId = bySlug.get(slug)
      if (!regionId || spots.length === 0) continue
      const ko = REGION_KO[slug] ?? slug
      const ids: bigint[] = []
      for (const s of spots) {
        const sp = await prisma.spot.create({
          data: {
            regionId, name: s.name, category: s.category, lat: s.lat, lng: s.lng,
            summary: `${ko} 대표 관광지`, address: `${ko} 일대`, avgStayMinutes: 60,
            images: { create: [{ url: s.image, sourceCredit: '한국관광공사', source: 'TOURAPI', sourceId: 'seed', sortOrder: 0 }] },
          },
        })
        ids.push(sp.id)
      }
      await prisma.course.create({
        data: {
          regionId, title: `${ko} 핵심 코스`, summary: `${ko} 대표 명소를 하루에 둘러보는 코스`,
          coverImageUrl: spots[0]!.image, durationDays: 1, estCost: 50000,
          // 자동생성 '핵심 코스'는 보조용 — 실제 KTO 추천코스보다 낮은 점수로 둔다
          status: 'PUBLISHED', publishedAt: new Date(), createdBy: editor.id, saveCount: 150,
          themes: { create: [{ themeId: themes['자연']! }] },
          items: { create: ids.map((spotId, i) => ({ dayNo: 1, sortOrder: i + 1, spotId, stayMinutes: 60 })) },
        },
      })
    }
  }

  // 공공데이터 관광 3종 적용(이름 매칭) — 생성된 스팟에 반려동물·무장애·연관 정보 주입
  for (const [name, t] of Object.entries(TOURISM_SEED)) {
    const data: Prisma.SpotUpdateManyMutationInput = { petFriendly: t.petFriendly, hasBarrierFree: t.hasBarrierFree }
    if (t.tourapiContentId) data.tourapiContentId = t.tourapiContentId
    if (t.petInfo) data.petInfo = t.petInfo as Prisma.InputJsonValue
    if (t.barrierFree) data.barrierFree = t.barrierFree as Prisma.InputJsonValue
    if (t.relatedSpots) data.relatedSpots = t.relatedSpots as Prisma.InputJsonValue
    await prisma.spot.updateMany({ where: { name }, data })
  }

  // KTO 여행코스 + 경유지(seed-courses.json) — 전국 실제 추천코스. 전체 시드(opts.regions)에서만 적재.
  // 관광 3종 적용(위) 이후에 생성해 이름매칭 updateMany와 cid 충돌을 피한다.
  if (opts.regions) {
    const allRegions = await prisma.region.findMany({ select: { id: true, slug: true } })
    const ridBySlug = new Map(allRegions.map((r) => [r.slug, r.id]))
    for (const sp of KTO_SEED.spots) {
      const rid = ridBySlug.get(sp.regionSlug)
      if (!rid) continue
      const ko = REGION_KO[sp.regionSlug] ?? sp.regionSlug
      await prisma.spot.create({
        data: {
          regionId: rid, name: sp.name, category: sp.category ?? '관광지', lat: sp.lat, lng: sp.lng,
          summary: `${ko} 관광지`, address: `${ko} 일대`, avgStayMinutes: 60, source: 'TOURAPI', tourapiContentId: sp.cid,
          ...(sp.image ? { images: { create: [{ url: sp.image, sourceCredit: '한국관광공사', source: 'TOURAPI', sourceId: 'kto', sortOrder: 0 }] } } : {}),
        },
      })
    }
    const cidToId = new Map(
      (await prisma.spot.findMany({ where: { tourapiContentId: { not: null } }, select: { id: true, tourapiContentId: true } }))
        .map((s) => [s.tourapiContentId as string, s.id]),
    )
    // 커버 폴백용: 경유지 cid → 이미지
    const cidToImage = new Map(KTO_SEED.spots.map((s) => [s.cid, s.image]))
    for (const c of KTO_SEED.courses) {
      const rid = ridBySlug.get(c.regionSlug)
      if (!rid) continue
      const items = (c.items ?? [])
        .filter((it) => cidToId.has(it.spotCid))
        .map((it) => ({
          dayNo: it.dayNo ?? 1, sortOrder: it.sortOrder ?? 1, spotId: cidToId.get(it.spotCid)!,
          stayMinutes: it.stayMinutes ?? undefined, transportToNext: (it.transportToNext as never) ?? undefined, transportMinutes: it.transportMinutes ?? undefined,
        }))
      if (items.length === 0) continue
      // 테마 추론(제목+요약) + 커버 폴백(없으면 경유지 사진) + 실제 추천코스라 핵심코스보다 높은 점수
      const themePicks = inferKtoThemes(`${c.title} ${c.summary ?? ''}`).map((n) => themes[n]).filter(Boolean) as bigint[]
      const cover = c.cover ?? (c.items ?? []).map((it) => cidToImage.get(it.spotCid)).find(Boolean) ?? undefined
      await prisma.course.create({
        data: {
          regionId: rid, title: c.title, summary: c.summary ?? undefined, durationDays: c.durationDays ?? 1, estCost: c.estCost ?? undefined,
          status: 'PUBLISHED', publishedAt: new Date(), createdBy: editor.id, source: 'TOURAPI', tourapiContentId: c.cid,
          coverImageUrl: cover, saveCount: 250 + items.length * 30,
          ...(themePicks.length ? { themes: { create: themePicks.map((themeId) => ({ themeId })) } } : {}),
          items: { create: items },
        },
      })
    }
  }

  // 유튜브 여행영상(seed-videos.json) — 지역별 영상 + buzzScore. 전체 시드에서만 적재.
  if (opts.regions) {
    const vidRegions = await prisma.region.findMany({ select: { id: true, slug: true } })
    const vridBySlug = new Map(vidRegions.map((r) => [r.slug, r.id]))
    for (const [slug, buzz] of Object.entries(VIDEO_SEED.buzz)) {
      const rid = vridBySlug.get(slug)
      if (rid) await prisma.region.update({ where: { id: rid }, data: { buzzScore: buzz } })
    }
    for (const v of VIDEO_SEED.videos) {
      const rid = vridBySlug.get(v.regionSlug)
      if (!rid) continue
      await prisma.video.create({
        data: {
          youtubeId: v.youtubeId, regionId: rid, title: v.title, channelTitle: v.channelTitle,
          thumbnailUrl: v.thumbnailUrl, viewCount: BigInt(v.viewCount),
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : null, durationSec: v.durationSec, sortOrder: v.sortOrder,
        },
      })
    }
  }

  // 지역 썸네일 백필 — 탐색/홈 지역 카드 이미지. 대표 코스 커버 → 없으면 지역 스팟 이미지 순.
  // (jeju는 생성 시 이미 설정됨) 전체 시드에서만 전국 지역 이미지를 채운다.
  if (opts.regions) {
    const regs = await prisma.region.findMany({ select: { id: true, thumbnailUrl: true } })
    for (const r of regs) {
      if (r.thumbnailUrl) continue
      const course = await prisma.course.findFirst({
        where: { regionId: r.id, coverImageUrl: { not: null } },
        orderBy: { saveCount: 'desc' },
        select: { coverImageUrl: true },
      })
      let url = course?.coverImageUrl ?? null
      if (!url) {
        const img = await prisma.spotImage.findFirst({
          where: { spot: { regionId: r.id } },
          orderBy: { id: 'asc' },
          select: { url: true },
        })
        url = img?.url ?? null
      }
      if (url) await prisma.region.update({ where: { id: r.id }, data: { thumbnailUrl: url } })
    }
  }

  return {
    regionId: jeju.id,
    themeIds: themes,
    spotIds,
    publishedCourseId: published.id,
    draftCourseId: draft.id,
    admins: { super: superAdmin.id, editor: editor.id, reviewer: reviewer.id },
  }
}
