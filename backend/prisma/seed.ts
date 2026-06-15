import { PrismaClient } from '@prisma/client'
import { runSeed } from './seed-core.js'

const prisma = new PrismaClient()
const password = process.env.SEED_ADMIN_PASSWORD ?? 'travelpack-dev-1234'

const result = await runSeed(prisma, password, 10, { regions: true })
const [regionCount, spotCount, courseCount] = await Promise.all([prisma.region.count(), prisma.spot.count(), prisma.course.count()])
console.log('시드 완료:')
console.log(`  지역 ${regionCount}곳 / 테마 8개 / 스팟 ${spotCount}곳 / 코스 ${courseCount}개 (전국 대표사진 + 관광 3종)`)
console.log(`  발행 코스 #${result.publishedCourseId} (제주 동부 힐링 2일), DRAFT 코스 #${result.draftCourseId}`)
console.log(`  관리자: super@travelpack.app, editor@travelpack.app, reviewer@travelpack.app (pw: ${password})`)
await prisma.$disconnect()
