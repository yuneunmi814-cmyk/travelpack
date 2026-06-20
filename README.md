# TravelPack 🧳

> **"패키지여행의 편안함을 앱으로."**
> 이것저것 알아보기 귀찮은 사람을 위해, 대표 명소 위주의 **검증된 여행 코스**를 추천하고
> 코스를 따라가며 쓰는 **가이드 모드**와 관광지 **큐레이션 정보**를 제공하는 모바일 앱. 안드로이드 우선.

핵심 가설: **여행 준비 시간을 3시간에서 3분으로 줄인다.**

콘텐츠는 **한국관광공사 TourAPI**(공공데이터)에서 수급하고, 에디터가 가공해 발행합니다. **전국 17개 시·도(23개 지역)·관광지 341곳·추천 코스 87개**를 담았고, 각 지역·코스·관광지에는 **유튜브 여행 쇼츠**(YouTube Data API)를 엮어 보여줍니다. 지도는 카카오맵, 인증은 JWT(RS256)+Refresh Rotation, 가이드 모드 체크인은 PostGIS 반경 검증을 씁니다.

## 📱 앱 미리보기

**여행 흐름** — 홈에서 코스를 고르고 → 여행을 시작하면 → 가이드 모드가 현재 위치로 도착을 체크인합니다.

<table>
<tr>
<td align="center"><img src="design/screens/01-home.png" width="200"><br/><b>① 홈</b><br/>추천 코스·인기 지역</td>
<td align="center"><img src="design/screens/02-course.png" width="200"><br/><b>② 코스 상세</b><br/>일자별 일정·여행 시작</td>
<td align="center"><img src="design/screens/03-guide.png" width="200"><br/><b>③ 가이드 모드</b><br/>경로 안내·도착 체크인</td>
<td align="center"><img src="design/screens/04-checkin.png" width="200"><br/><b>④ 체크인 완료</b><br/>진행률·다음 안내</td>
</tr>
</table>

**커뮤니티 — 여행팩 공유** — 여행 고수의 코스를 무료로 구경하고, 내 코스를 만들어 자랑합니다.

<table>
<tr>
<td align="center"><img src="design/screens/05-market.png" width="200"><br/><b>⑤ 여행팩 둘러보기</b><br/>인기순·저장수</td>
<td align="center"><img src="design/screens/06-paywall.png" width="200"><br/><b>⑥ 여행팩 상세</b><br/>전체 일정·저장·여행 시작</td>
<td align="center"><img src="design/screens/07-editor.png" width="200"><br/><b>⑦ 코스 만들기</b><br/>일정 구성·검수 요청</td>
<td align="center"><img src="design/screens/08-about.png" width="200"><br/><b>⑧ 사업자 정보</b><br/>약관·신원 정보</td>
</tr>
</table>

> 위 미리보기는 화면 구성을 반영한 디자인 목업이며, **관광지 사진은 한국관광공사 TourAPI 대표사진**입니다(실제 앱도 동일 출처를 불러오며, 시드에 실제 이미지 URL이 포함됩니다). 사진 © 한국관광공사(TourAPI). 실기기 캡처로 교체 가능.

## 저장소 구성 (모노레포)

| 경로 | 내용 |
|---|---|
| [`docs/`](docs/) | 종합 기획·설계서 v1.2 — 화면/DB/API/아키텍처/보안·개인정보 법령/CRUD |
| [`design/wireframes.html`](design/wireframes.html) | 전체 20개 화면 와이어프레임 (브라우저로 열람) |
| [`design/logo.html`](design/logo.html) · [`design/logo/`](design/logo/) | 브랜드 로고·iOS/Android 앱 아이콘 세트 (설치 [ICONS.md](design/logo/ICONS.md)) |
| [`backend/`](backend/) | API 서버 — Express + TS + Prisma + PostgreSQL(PostGIS). TourAPI 동기화·S3·FCM·파기 배치 포함 |
| [`admin-web/`](admin-web/) | 관리자 웹(CMS) — React + Vite + TS |
| [`mobile/`](mobile/) | 안드로이드 앱 — React Native(Expo) + TS |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) · [`render.yaml`](render.yaml) | 체험용 Docker 실행 + 클라우드 배포(Render 블루프린트: API·PostGIS·Redis·CMS) |
| [`docs/launch-checklist.md`](docs/launch-checklist.md) | **출시 체크리스트** — 배포·양대 스토어(Google Play/App Store)·법무 최종 정리 |
| [`docs/store-submission.md`](docs/store-submission.md) | **스토어 제출 자료(복붙용)** — 설명문구·데이터안전/개인정보·연령등급·심사정보·스크린샷 캡션 |
| [`docs/legal/`](docs/legal/) | 법무 문서 초안 — 이용약관·개인정보처리방침·위치약관·청약철회정책 (변호사 검토 전) |

---

# 🧭 앱 사용법 (이용자)

로그인 없이도 **둘러보기**가 되고, 저장·여행 시작·구매 등 내 데이터가 생기는 기능은 로그인하면 됩니다.

1. **코스 찾기** — 홈의 추천 코스(전국 87개), 🎬 여행 쇼츠·🔥 요즘 뜨는 여행지, 지역·테마 탐색, 또는 상단 🔍 통합 검색(코스·관광지·지역)으로 마음에 드는 코스를 찾습니다.
2. **코스 살펴보기** — 코스 상세에서 일자별 일정·지도·**관광지 사진 슬라이드쇼**·**관련 유튜브 영상**, 관광지 정보(운영시간·요금·꿀팁·사진·오디오 가이드, KO/EN)를 확인합니다.
3. **여행 시작** — "이 코스로 여행 시작"을 누르면 일정이 내 여행으로 만들어집니다.
4. **가이드 모드** — 코스를 따라 이동하다 관광지 근처에 도착하면 **현재 위치로 자동 체크인**(반경 밖이면 "그래도 체크인"=수동). 진행률과 다음 장소를 안내합니다.
5. **저장·리뷰** — 코스/관광지를 북마크하고, 다녀온 곳에 별점·리뷰를 남깁니다.
6. **여행팩 둘러보기(커뮤니티)** — 다른 사람이 공유한 여행팩을 인기순/최신순으로 구경하고, 마음에 들면 저장하거나 바로 여행을 시작합니다. (전부 무료)
7. **내 여행팩 만들어 공유하기** — MY → 내 여행팩 → 새 여행팩 만들기에서 지역·기간·일자별 스팟을 구성해 **검수 요청** → 관리자 승인 후 커뮤니티에 무료로 공개·자랑됩니다.
8. **사업자 정보·약관** — MY 하단에서 사업자 신원정보와 약관·정책을 확인할 수 있습니다.

> 지도·카카오 로그인은 카카오 키 + 네이티브 빌드가 있을 때 활성화되며, 키가 없어도 앱은 정상 동작합니다(지도는 대체 표시).

---

# 📖 개발자 매뉴얼 (빌드·실행)

## 사전 준비

| 도구 | 버전 | 비고 |
|---|---|---|
| Node.js | 22 LTS 이상 | 전 패키지 공통 |
| PostgreSQL | 16+ **+ PostGIS** | 백엔드 필수. 미설치 시 Docker로 대체 |
| Docker (선택) | — | PostGIS/Redis를 컨테이너로 띄울 때 |
| Android Studio / Expo | — | 모바일 앱 실행용 |

```bash
git clone https://github.com/<owner>/travelpack.git
cd travelpack
```

## 1) 백엔드 (API 서버)

```bash
cd backend
npm install
cp .env.example .env        # 환경변수 설정(아래 표 참고)
```

**데이터베이스 준비** — 둘 중 하나

- **Homebrew PostgreSQL + PostGIS** (로컬 설치형)
  ```bash
  createdb travelpack_dev && createdb travelpack_test
  # .env: DATABASE_URL=postgresql://<사용자>@localhost:5432/travelpack_dev
  ```
- **Docker** (PostGIS·Redis 컨테이너)
  ```bash
  docker compose up -d       # PostGIS :5433, Redis :6379
  # .env: DATABASE_URL=postgresql://travelpack:travelpack@localhost:5433/travelpack_dev
  ```

**마이그레이션·시드·실행**

```bash
npm run db:migrate      # 스키마 적용(PostGIS 확장·GIST 인덱스·좌표 동기화 트리거 포함)
npm run db:seed         # 전국 시드(23지역·관광지 341·발행코스 87·유튜브영상 184·관리자 3계정·심사용 데모)
npm run dev             # 개발 서버 → http://localhost:4000  (헬스체크: GET /health)
npm test                # vitest 통합 테스트 88개 (travelpack_test DB)
npm run typecheck       # tsc --noEmit
```

응답 규약: `{ "success": true, "data": ... }` / `{ "success": false, "error": { "code", "message" } }` · BigInt id는 문자열로 직렬화.

## 2) 관리자 웹 (CMS)

```bash
cd admin-web
npm install
npm run dev             # http://localhost:5173  (/api 요청은 :4000으로 프록시)
```

백엔드가 먼저 떠 있어야 합니다. 브라우저에서 접속 → 시드 관리자 계정으로 로그인.

- 대시보드, 관광지/코스 CRUD, **발행 워크플로(DRAFT→검수요청→4-eyes 발행→회수)**, 회원·신고·배너·푸시 캠페인
- 역할(RBAC)에 따라 좌측 메뉴가 달라집니다.

## 3) 모바일 앱 (안드로이드)

```bash
cd mobile
npm install
cp .env.example .env    # EXPO_PUBLIC_API_BASE, (선택) EXPO_PUBLIC_KAKAO_NATIVE_KEY
npm run android         # 또는: npx expo start → a
```

- 안드로이드 에뮬레이터는 호스트 API를 `10.0.2.2:4000`으로 접근(기본값). 실기기는 PC의 LAN IP로 `EXPO_PUBLIC_API_BASE` 지정.
- **지도·카카오 로그인**은 카카오 네이티브 키 + 네이티브 dev build(`npx expo run:android`)가 필요합니다. 키가 없으면 지도는 플레이스홀더, 카카오 로그인은 비활성이지만 앱은 정상 동작합니다.
- 검증: `npm run typecheck`, `npx expo export -p android`(번들 생성 확인).

## 4) 콘텐츠 수급 — TourAPI 동기화

공공데이터포털에서 **한국관광공사 국문 관광정보 서비스(KorService2)** serviceKey를 발급받아 `backend/.env`의 `TOURAPI_SERVICE_KEY`에 넣습니다.

```bash
cd backend
# 관광지 동기화 (지역·콘텐츠 타입별)
npm run sync:tourapi -- --region=jeju --types=12,39 --max=100 [--overview] [--dry-run]
# 여행코스 import (경유지를 좌표 POI에 연결해 DRAFT 코스 생성 → 에디터가 4-eyes 발행)
npm run sync:tourapi -- --region=jeju --courses --max=10 [--dry-run]
# 전 지역
npm run sync:tourapi -- --all --courses --max=10
```

지역 slug: `jeju busan gyeongju yeosu gangneung jeonju` · 멱등(재실행 시 기존 코스 보존, 스팟 가공 필드 보존) · `--dry-run`으로 호출만 미리 확인.

```bash
# 오디오 가이드(한국관광공사 오디·Odii) — 스팟 좌표 반경으로 오디오 스토리 매칭 (동일 키, 15101971 활용신청 필요)
npm run sync:audioguide -- --region=jeju [--langs=ko,en] [--radius=1000] [--dry-run]
```
스팟 상세 응답에 `audioGuides[]`(언어별·오디오 우선)가 포함되고, 앱 관광지 상세에서 `expo-audio`로 재생 + 대본 표시됩니다.

```bash
# 부가 공공데이터 (동일 키, 각 데이터셋 활용신청 필요)
npm run sync:photos -- --region=jeju      # 관광사진 → 스팟 갤러리(spot_images)
npm run sync:i18n -- --region=jeju        # 영문 관광정보 → 스팟 번역(spot 상세 ?lang=en)
npm run sync:visitors                     # 지역별 방문자수 → 인기 정렬·배지(region.visitorScore)
```

```bash
# 유튜브 여행영상 (YouTube Data API v3 — 별도 키 YOUTUBE_API_KEY, Google Cloud 발급)
npm run sync:youtube -- --all [--max=8]   # 지역별 여행 쇼츠 → videos 테이블·region.buzzScore
```
지역별 `{지역} 여행` 짧은 영상을 조회수순으로 수집(음원 채널 제외)합니다. 홈 "🎬 여행 쇼츠"·"🔥 요즘 뜨는 여행지", 코스/관광지 상세에 영상이 노출되고, 앱에서 탭하면 인앱(WebView)으로 재생됩니다. 결과는 `prisma/seed-videos.json`에 베이크돼 라이브 API 없이 재현됩니다.

## 5) 운영 배치

```bash
cd backend
npm run purge [-- --dry-run]   # 탈퇴 30일 후 완전 파기 + 체크인 좌표 6개월 후 NULL (일 1회 크론 권장)
```

## 6) 커뮤니티 — 여행팩 무료 공유 (설계서 7장)

사용자가 직접 코스를 만들어 **무료로 공유·자랑**합니다. (v1은 무료 전용 — 유료 결제 코드는 보존된 채 비활성)

- **만들기**: 앱 `MY → 내 여행팩 → 새 여행팩 만들기`. 지역·기간·테마·일자별 스팟(기존 큐레이션 관광지에서 선택)을 구성 → **검수 요청**.
- **검수·발행**: 관리자 CMS가 기존 발행 워크플로로 승인(작성자=사용자 ≠ 승인자=관리자, 4-eyes 자연 성립) → 커뮤니티 노출.
- **둘러보기·저장**: 인기순(저장수)/최신순으로 구경 → 저장(북마크)하거나 바로 여행 시작. 홈 "커뮤니티 인기 여행팩" 섹션에도 노출.
- **API**: `POST/PUT /me/courses`·`/submit`·`/withdraw`, `GET /marketplace/courses?sort=popular|latest`, `GET /me/courses`.

> 💤 유료화 보류: 결제(PortOne)·이용권·페이월·정산 코드는 **그대로 보존**되어 있고(`PG_PROVIDER`+`PG_API_SECRET` + 모바일 가격칸 복원 + price>0 발행 시 재활성), 출시 전 법무(통신판매업·청약철회·정산)는 **유료화 시점에만** 필요합니다.

## 환경변수 (`backend/.env`)

| 키 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL(PostGIS) 연결 문자열 |
| `TEST_DATABASE_URL` | 테스트 | `npm test`용 DB |
| `REDIS_URL` | — | 비우면 인메모리(개발 전용). 운영은 필수 |
| `TOURAPI_SERVICE_KEY` | 수급 시 | 공공데이터포털 발급 키. 없으면 `sync:tourapi` 비활성 |
| `YOUTUBE_API_KEY` | 영상 수급 시 | Google Cloud YouTube Data API v3 키(서버 전용). 없으면 `sync:youtube` 비활성. 영상은 시드에 베이크돼 운영엔 없어도 됨 |
| `S3_BUCKET` / `AWS_REGION` | 업로드 시 | 없으면 `/uploads/presigned-url` 503 |
| `FCM_PROJECT_ID` | 푸시 시 | 없으면 푸시 캠페인은 수신자 집계만(no-op) |
| `PG_PROVIDER` / `PG_API_SECRET` | 유료판매 시 | 마켓플레이스 결제 PG. 없으면 유료 코스 구매 503(무료 코스·작성·발행은 정상) |
| `MARKETPLACE_FEE_PERCENT` | — | 플랫폼 수수료율(%), 기본 20 |
| `JWT_*` / `BCRYPT_ROUNDS` | — | 기본값 제공. 키(keys/*.pem)는 자동 생성 |

모바일(`mobile/.env`): `EXPO_PUBLIC_API_BASE`, `EXPO_PUBLIC_KAKAO_NATIVE_KEY`(로그인), `EXPO_PUBLIC_KAKAO_JS_KEY`+`EXPO_PUBLIC_KAKAO_MAP_DOMAIN`(가이드 지도 — WebView 카카오맵), (선택) `EXPO_PUBLIC_GOOGLE_*`(구글 로그인). 유튜브 키는 백엔드 전용이라 앱엔 없음.

## 기본 계정 (시드)

| 이메일 | 역할 | 비밀번호 |
|---|---|---|
| `super@travelpack.app` | 총괄 관리자 | `travelpack-dev-1234` |
| `editor@travelpack.app` | 콘텐츠 매니저(작성) | `travelpack-dev-1234` |
| `reviewer@travelpack.app` | 콘텐츠 매니저(검수·발행) | `travelpack-dev-1234` |

> 4-eyes 정책상 코스 **발행은 작성자가 아닌 다른 콘텐츠 매니저**만 가능합니다(editor 작성 → reviewer 발행).

## 트러블슈팅

- **PostGIS 오류 / `geography` 타입 없음** → DB에 PostGIS 확장 필요. Docker 이미지(`postgis/postgis`) 사용 또는 `CREATE EXTENSION postgis;` (마이그레이션이 자동 수행).
- **`P1010 User was denied access`** → `DATABASE_URL`에 사용자명 포함 확인 (예: `postgresql://yoon@localhost:5432/...`).
- **에뮬레이터에서 API 연결 안 됨** → `EXPO_PUBLIC_API_BASE`를 `10.0.2.2:4000`(에뮬) 또는 LAN IP(실기기)로.
- **지도가 안 보임** → 카카오 네이티브 키 + dev build 필요(위 3번 참고).

---

## 기술 스택

React Native(Expo SDK 56) + TypeScript · React + Vite(CMS) · Node.js 22 + Express + Prisma ·
PostgreSQL 16 + PostGIS · Redis 7 · JWT(RS256)+RTR · Kakao Maps(WebView JS SDK) · YouTube Data API v3 · FCM · AWS 서울 리전. (선정 사유: 기획설계서 0.2절)

## 진행 상태

- [x] 기획·설계 문서, 와이어프레임 20화면, 오픈 이슈 4건 결정
- [x] 브랜드 로고 + iOS/Android 앱 아이콘 세트
- [x] 백엔드 API(인증 RTR·탐색·저장·여행/체크인·리뷰·관리자 4-eyes·감사로그) — 테스트 88개
- [x] 관리자 웹(CMS) 코어 — 브라우저 E2E 검증
- [x] TourAPI 동기화(관광지 + 여행코스 import) — **전국 17개 시·도(23개 지역)·관광지 341곳·발행 코스 87개** 라이브 적재
- [x] S3 업로드·FCM 푸시·데이터 파기 배치
- [x] 모바일 앱 핵심 — 탐색→코스→가이드 모드, 카카오맵·카카오 로그인·온보딩/약관·리뷰/북마크
- [x] **오디오 가이드(한국관광공사 오디)** — 스팟 좌표 매칭 동기화 + 앱 오디오 플레이어(대본·다국어). 제주 라이브 검증
- [x] **부가 공공데이터 연동** — 관광사진(스팟 갤러리)·영문 i18n(스팟 상세 ?lang=en)·지역 방문자수(인기 정렬/배지). 제주 라이브 검증, 백엔드 테스트 59개
- [x] **M3 마감** (2026-06-13) — 관심테마(ON-02)·구글 로그인·FCM 토큰 등록 완료. 카카오맵 커스텀 마커는 라이브러리 미지원(내장 POI 대체, WebView+JS SDK는 후속)
- [x] **커뮤니티 여행팩 공유(설계서 7장)** — 사용자가 코스를 만들어 **무료 공유·자랑**. 작성·검수(4-eyes)·둘러보기(인기/최신)·저장, 홈 커뮤니티 섹션. **v1 무료 전용** — 유료 결제·이용권·페이월·정산 코드는 보존된 채 비활성(유료화 시 스위치). 백엔드 테스트 88개. 출시 절차: [docs/legal/출시_인허가_가이드.md](docs/legal/출시_인허가_가이드.md)
- [x] **출시 준비** — PG(PortOne) 연동 코드·Docker 풀스택·CI·법무 초안·통합 검색·영문 토글(KO/EN)·카카오맵 WebView 마커/경로선 완료. 사업자(프로젝트윤·간이과세자) 등록 → **통신판매업 신고 면제**, **위치기반서비스사업 신고 수리 완료(제1175호)**
- [x] **클라우드 배포** — 백엔드 Render 라이브(`travelpack-api.onrender.com`)·법무 약관 Netlify 호스팅·Android EAS 빌드(.aab)
- [x] **유튜브 여행영상 큐레이션** — 전국 184개 쇼츠(홈 피드·🔥 요즘 뜨는 여행지·코스/관광지 임베드, 인앱 WebView 재생)·**코스 상세 사진 슬라이드쇼**·KTO 코스 큐레이션(홈 추천 87개 실제 코스)
- [ ] **M4** ← 다음 단계: 스토어 심사 제출·실기기 QA(카카오맵 WebView 렌더·유튜브 재생 검증)·침투 테스트

## 출시 전 필수 체크 (법무)

가이드 모드가 위치정보를 사용하므로 위치기반서비스사업자 신고가 출시의 선행 조건이며, **신고 수리 완료(제1175호, 방송미디어통신사무소)** 되었습니다. v1은 무료 공유 모델이라 통신판매업 신고·PG·정산은 유료화 시점에만 필요합니다. 상세 체크리스트는 기획설계서 6.1절 및 [docs/legal/출시_인허가_가이드.md](docs/legal/출시_인허가_가이드.md).

## 라이선스

[MIT](LICENSE) © 2026 TravelPack

openclaw 원격 코딩 테스트

푸시 테스트
