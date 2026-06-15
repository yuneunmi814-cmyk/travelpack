import { prisma } from '../src/lib/prisma.js'
import { env } from '../src/config/env.js'
import { TOURISM_REGIONS } from '../src/modules/tourism/regions.js'
import { syncTourism, type TourismSyncResult } from '../src/modules/tourism/sync.js'

// 관광 3종 동기화 (동일 TOURAPI_SERVICE_KEY — 각 데이터셋 활용신청 필요):
//   반려동물 동반(detailPetTour2) · 무장애(detailWithTour2) · 연관관광지(TarRlteTar)
//   npm run sync:tourism -- --region=jeju [--dry-run] [--baseYm=202406]
//   npm run sync:tourism -- --all [--dry-run]
function arg(name: string): string | undefined { return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] }
const flag = (n: string) => process.argv.includes(`--${n}`)

function print(slug: string, s: TourismSyncResult, dry: boolean) {
  console.log(`✔ ${slug}: 스팟 ${s.spotsProcessed} · contentId백필 ${s.contentIdBackfilled} · 반려동물 ${s.pet} · 무장애 ${s.barrierFree} · 연관 ${s.relatedSpots}${s.regionsMissed.length ? ` (연관無: ${s.regionsMissed.join(',')})` : ''}${dry ? ' DRY' : ''}`)
}

async function main() {
  if (!env.TOURAPI_SERVICE_KEY) { console.error('✖ TOURAPI_SERVICE_KEY 필요(관광 3종도 동일 키, 각 데이터셋 활용신청 필요).'); process.exit(1) }
  const dryRun = flag('dry-run')
  const baseYm = arg('baseYm')

  if (flag('all')) {
    const s = await syncTourism(prisma, { dryRun, baseYm })
    print('전체', s, dryRun)
  } else {
    const slug = arg('region')
    if (!slug || !TOURISM_REGIONS[slug]) { console.error('✖ --region=<jeju|busan|gyeongju|yeosu|gangneung|jeonju> 또는 --all'); process.exit(1) }
    const s = await syncTourism(prisma, { regionSlug: slug, dryRun, baseYm })
    print(slug, s, dryRun)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
