import { PrismaClient } from '@prisma/client'
import { applyYoutubeCourses } from '../prisma/youtube-courses-loader.js'

// '🎬 유튜브 추천 코스'를 DATABASE_URL 대상 DB에 추가 삽입(멱등, 비파괴).
// 로컬 검수용 + 운영 추가삽입용(전체 재시드 없이). 에디터 admin·테마는 DB에서 조회.
const prisma = new PrismaClient()
async function main() {
  const editor = await prisma.adminUser.findFirst({
    where: { OR: [{ email: 'editor@travelpack.app' }, { role: 'CONTENT_MANAGER' }, { role: 'SUPER_ADMIN' }] },
    select: { id: true },
  })
  if (!editor) { console.error('✖ 에디터 관리자 없음'); process.exit(1) }
  const themes = await prisma.theme.findMany({ select: { id: true, name: true } })
  const themeIdByName = Object.fromEntries(themes.map((t) => [t.name, t.id]))
  const n = await applyYoutubeCourses(prisma, editor.id, themeIdByName)
  console.log(`✔ 유튜브 추천 코스 ${n}개 추가(이미 있으면 건너뜀)`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
