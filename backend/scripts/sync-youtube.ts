import { prisma } from '../src/lib/prisma.js'
import { env } from '../src/config/env.js'
import { syncYoutubeAll, syncYoutubeRegion } from '../src/modules/youtube/sync.js'

// 유튜브 여행영상 동기화 (YouTube Data API v3, YOUTUBE_API_KEY 필요):
//   npm run sync:youtube -- --all [--max=8] [--dry-run]
//   npm run sync:youtube -- --region=jeju [--max=8] [--dry-run]
const flag = (n: string) => process.argv.includes(`--${n}`)
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]

async function main() {
  if (!env.YOUTUBE_API_KEY) {
    console.error('✖ YOUTUBE_API_KEY 필요 (Google Cloud → YouTube Data API v3 키).')
    process.exit(1)
  }
  const dryRun = flag('dry-run')
  const want = arg('max') ? Number(arg('max')) : 8
  const slug = arg('region')

  if (flag('all') || !slug) {
    const res = await syncYoutubeAll(prisma, { want, dryRun })
    for (const r of res) console.log(`✔ ${r.region}: 영상 ${r.videos} · buzz ${r.buzz}`)
    console.log(`— 합계 영상 ${res.reduce((a, r) => a + r.videos, 0)} / 지역 ${res.length}${dryRun ? ' (DRY)' : ''}`)
  } else {
    const region = await prisma.region.findFirst({ where: { slug }, select: { id: true, name: true } })
    if (!region) { console.error(`✖ 지역 없음: ${slug}`); process.exit(1) }
    const r = await syncYoutubeRegion(prisma, region, { want, dryRun })
    console.log(`✔ ${r.region}: 영상 ${r.videos} · buzz ${r.buzz}${dryRun ? ' (DRY)' : ''}`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
