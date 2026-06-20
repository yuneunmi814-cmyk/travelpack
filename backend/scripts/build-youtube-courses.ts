import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
import { env } from '../src/config/env.js'

// 코스형 유튜브 쇼츠 설명에서 추출한 지역별 장소 목록(검수 완료, 관광지 위주).
// 각 장소를 기존 스팟 매칭 → 없으면 TourAPI searchKeyword2로 좌표/사진 확보 → '🎬 유튜브 추천 코스' 조립.
const REGION_KO: Record<string, string> = {
  jeju: '제주', gyeongju: '경주', yeosu: '여수', jeonju: '전주', seoul: '서울', incheon: '인천',
  sokcho: '속초', ulsan: '울산', sejong: '세종', chuncheon: '춘천', andong: '안동', suncheon: '순천', pohang: '포항', gongju: '공주',
}

interface Extract { slug: string; vid: string; src: string; title: string; theme: string; spots: string[] }
const EXTRACT: Extract[] = [
  { slug: 'jeju', vid: 'hZObjTVVQSE', src: '이대로 따라해도 성공함! 2박 3일 제주도 서쪽 여행 코스', title: '제주 서쪽 가볼만한곳 코스', theme: '자연',
    spots: ['도두봉', '이호테우해변', '구엄리돌염전', '수산봉', '한담해안산책로', '곽지과물해변', '귀덕포구', '수월봉'] },
  { slug: 'gyeongju', vid: 'oIKKUKVIITs', src: '경주여행 2박 3일 숨겨진 힐링 코스 총정리', title: '경주 2박3일 힐링 코스', theme: '역사',
    spots: ['황리단길', '월정교', '첨성대', '대릉원', '동궁과 월지', '경주월드'] },
  { slug: 'yeosu', vid: 'EEBnRqaDvDw', src: '여수 여행지 가볼만한곳 15곳 모음', title: '여수 가볼만한곳 코스', theme: '자연',
    spots: ['오동도', '향일암', '하멜등대', '여수 교동시장', '돌산공원'] },
  { slug: 'jeonju', vid: 'hwmSRsz0MeY', src: '전주여행 코스 12곳 총정리', title: '전주 레트로 감성 코스', theme: '역사',
    spots: ['전주한옥마을', '오목대', '전동성당', '전주향교', '전주수목원', '덕진공원'] },
  { slug: 'seoul', vid: '-6s0WZBiX8A', src: '서울 가볼만한곳 싹 다 모음집 BEST11', title: '서울 가볼만한곳 코스', theme: '힐링',
    spots: ['청와대 사랑채', '서울시립미술관', '배재학당역사박물관', '용마산', '해방촌', '국회의사당'] },
  { slug: 'incheon', vid: 'Hgrbo6Ws6nY', src: '인천 필수 여행 코스 BEST6', title: '인천 개항장·차이나타운 코스', theme: '역사',
    spots: ['차이나타운', '월미도', '송월동 동화마을', '자유공원', '인천대공원'] },
  { slug: 'sokcho', vid: 'G31K2lV6Wa4', src: '속초 여행 당일치기 Best 6곳', title: '속초 당일치기 코스', theme: '자연',
    spots: ['아바이마을', '속초관광수산시장', '영금정', '대포항', '청초호'] },
  { slug: 'ulsan', vid: '-dF7TTaoBE4', src: '생각보다 정말 멋진 울산 여행지 5곳', title: '울산 가볼만한곳 코스', theme: '자연',
    spots: ['간절곶', '대왕암공원', '일산해수욕장', '슬도', '태화강 국가정원'] },
  { slug: 'sejong', vid: 'AjB6dtSOP14', src: '세종 여행 코스 가볼만한곳 베스트6', title: '세종 아이와 가볼만한곳 코스', theme: '자연',
    spots: ['베어트리파크', '밀마루전망대', '국립세종수목원', '세종호수공원', '금강보행교'] },
  { slug: 'chuncheon', vid: 'RUGlBCxxUgQ', src: '서울에서 당일치기 춘천 여행 코스 총정리', title: '춘천 당일치기 코스', theme: '힐링',
    spots: ['해피초원목장', '국립춘천박물관', '중도', '소양강스카이워크', '제이드가든'] },
  { slug: 'andong', vid: 'rBDsXdvVxm0', src: '국내에서 가장 좋은 여행지, 안동 명소 BEST5', title: '안동 명소 코스', theme: '역사',
    spots: ['만휴정', '병산서원', '월영교', '봉정사', '하회마을'] },
  { slug: 'suncheon', vid: 'feUJyyf-9Ik', src: '순천 여행 가볼만한곳 필수 코스 7곳', title: '순천 가볼만한곳 코스', theme: '자연',
    spots: ['순천만국가정원', '순천만습지', '낙안읍성', '순천드라마촬영장'] },
  { slug: 'pohang', vid: 'iZ1n9G_kXus', src: '포항여행 BEST10 가볼만한 곳', title: '포항 가볼만한곳 코스', theme: '자연',
    spots: ['호미곶', '스페이스워크', '구룡포 일본인 가옥거리', '영일대해수욕장', '죽도시장', '이가리 닻 전망대'] },
  { slug: 'gongju', vid: 'odzy1YFpFMI', src: '숨겨진 여행지 공주 가볼만한곳', title: '공주 백제 역사 코스', theme: '역사',
    spots: ['마곡사', '갑사', '공산성', '무령왕릉', '국립공주박물관'] },
]

interface GeoSpot { name: string; lat: number; lng: number; image: string | null; matched: boolean }

async function geocode(name: string, regionKo: string): Promise<{ lat: number; lng: number; image: string | null } | null> {
  const sp = new URLSearchParams({
    serviceKey: env.TOURAPI_SERVICE_KEY ?? '', MobileOS: 'ETC', MobileApp: 'TravelPack', _type: 'json',
    keyword: name, numOfRows: '10', arrange: 'O',
  })
  const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${sp.toString()}`)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) return null
  let items: unknown
  try { items = JSON.parse(text)?.response?.body?.items?.item } catch { return null }
  const arr = (Array.isArray(items) ? items : items ? [items] : []) as { mapx?: string; mapy?: string; firstimage?: string; addr1?: string }[]
  // 지역명이 주소에 포함된 결과 우선(동명이인 방지)
  const inRegion = arr.filter((it) => it.addr1?.includes(regionKo) && it.mapx && it.mapy)
  const pick = inRegion[0] ?? arr.find((it) => it.mapx && it.mapy)
  if (!pick) return null
  return { lat: Number(pick.mapy), lng: Number(pick.mapx), image: pick.firstimage || null }
}

async function main() {
  const out: (Extract & { resolved: GeoSpot[] })[] = []
  for (const e of EXTRACT) {
    const region = await prisma.region.findFirst({ where: { slug: e.slug }, select: { id: true } })
    if (!region) { console.warn('지역없음', e.slug); continue }
    const regionKo = REGION_KO[e.slug] ?? e.slug
    const resolved: GeoSpot[] = []
    for (const name of e.spots) {
      const existing = await prisma.spot.findFirst({ where: { regionId: region.id, name: { contains: name } }, select: { name: true, lat: true, lng: true } })
      if (existing) { resolved.push({ name: existing.name, lat: existing.lat, lng: existing.lng, image: null, matched: true }); continue }
      const g = await geocode(name, regionKo)
      if (g) resolved.push({ name, lat: g.lat, lng: g.lng, image: g.image, matched: false })
      else console.warn(`  ⚠️ 좌표 못 찾음: ${e.slug} / ${name}`)
    }
    out.push({ ...e, resolved })
    console.log(`✔ ${e.slug.padEnd(10)} ${resolved.length}/${e.spots.length}곳 (기존매칭 ${resolved.filter((s) => s.matched).length})`)
  }
  writeFileSync(new URL('../prisma/seed-youtube-courses.json', import.meta.url), JSON.stringify(out, null, 1))
  console.log(`\n📁 seed-youtube-courses.json 저장 — ${out.length}개 코스`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
