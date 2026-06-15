// 연관관광지(TarRlteTar)는 법정동 코드 기반. areaCd=법정동 시도, signguCd=법정동 시군구.
// korAreaCode=KorService searchKeyword2용(contentId 백필).
// 광역시/도는 우리 스팟이 위치한 시군구만 조회. (제주시 50110은 라이브 검증됨)
export interface TourismRegion { korAreaCode: number; areaCd: string; signguCds: string[] }
export const TOURISM_REGIONS: Record<string, TourismRegion> = {
  jeju: { korAreaCode: 39, areaCd: '50', signguCds: ['50110', '50130'] },               // 제주시·서귀포시
  busan: { korAreaCode: 6, areaCd: '26', signguCds: ['26350', '26500', '26200', '26380', '26710'] }, // 해운대·수영·영도·사하·기장
  gyeongju: { korAreaCode: 35, areaCd: '47', signguCds: ['47130'] },                     // 경주시
  yeosu: { korAreaCode: 38, areaCd: '46', signguCds: ['46130'] },                        // 여수시
  gangneung: { korAreaCode: 32, areaCd: '51', signguCds: ['51150'] },                    // 강릉시
  jeonju: { korAreaCode: 37, areaCd: '52', signguCds: ['52111', '52113'] },              // 완산구·덕진구
  seoul: { korAreaCode: 1, areaCd: '11', signguCds: ['11110', '11140', '11170', '11200'] }, // 종로·중·용산·성동
  incheon: { korAreaCode: 2, areaCd: '28', signguCds: ['28110', '28185', '28200'] },     // 중구·연수·남동
  daegu: { korAreaCode: 4, areaCd: '27', signguCds: ['27110', '27200', '27260', '27290'] }, // 중·남·수성·달서
  daejeon: { korAreaCode: 3, areaCd: '30', signguCds: ['30110', '30170', '30200'] },     // 중·서·유성
  gwangju: { korAreaCode: 5, areaCd: '29', signguCds: ['29110', '29155', '29170', '29200'] }, // 동·남·북·광산
  sokcho: { korAreaCode: 32, areaCd: '51', signguCds: ['51210'] },                       // 속초시
}

// 연관관광지 데이터는 약 1년 지연 — 데이터 있는 최신 기준연월부터 시도.
export const RELATED_BASE_YMS = ['202406', '202403', '202312', '202409', '202506']
