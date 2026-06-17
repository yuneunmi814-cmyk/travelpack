import { PrismaClient } from '@prisma/client'
import { runSeed } from './seed-core.js'

// 프로덕션 안전 시드 — 기동 시(Dockerfile) 1회 실행.
// runSeed()는 파괴적(전체 deleteMany 후 재생성)이므로, 반드시 가드를 통과할 때만 실행:
//   ① SEED_ON_START !== 'false'  (기본 활성 — 끄려면 환경변수 SEED_ON_START=false)
//   ② 기존 데이터가 비어 있음(region.count() === 0)  ← 이미 채워졌으면 절대 덮어쓰지 않음
//   ③ 예외: SEED_FORCE=true 면 데이터가 있어도 강제로 삭제 후 재시드(콘텐츠 갱신용 1회성).
//      ⚠️ 켜둔 채로 두면 재기동마다 데이터가 초기화되니, 갱신 후 반드시 다시 끌 것.
// 어떤 오류가 나도 서버 기동은 계속되도록 예외를 삼킨다(시드 실패가 배포를 막지 않게).
const prisma = new PrismaClient()
const force = process.env.SEED_FORCE === 'true'
try {
  if (process.env.SEED_ON_START === 'false' && !force) {
    console.log('[seed-prod] SEED_ON_START=false → 시드 건너뜀')
  } else {
    const existing = await prisma.region.count()
    if (existing > 0 && !force) {
      console.log(`[seed-prod] 이미 데이터 존재(지역 ${existing}곳) → 시드 건너뜀(덮어쓰지 않음)`)
    } else {
      if (force && existing > 0) console.warn(`[seed-prod] ⚠️ SEED_FORCE=true — 기존 데이터(지역 ${existing}곳)를 삭제하고 재시드합니다`)
      const password = process.env.SEED_ADMIN_PASSWORD ?? 'travelpack-dev-1234'
      const result = await runSeed(prisma, password, 10, { regions: true })
      const [regions, spots, courses] = await Promise.all([prisma.region.count(), prisma.spot.count(), prisma.course.count()])
      console.log(`[seed-prod] 초기 시드 완료 — 지역 ${regions}곳 / 스팟 ${spots} / 코스 ${courses}`)
      console.log(`[seed-prod] 발행 코스 #${result.publishedCourseId} · 관리자 super@/editor@/reviewer@travelpack.app`)
    }
  }
} catch (e) {
  console.error('[seed-prod] 시드 실패(서버 기동은 계속):', e instanceof Error ? e.message : e)
} finally {
  await prisma.$disconnect()
}
