# TravelPack

패키지여행식 관광가이드 앱 (안드로이드 우선). 단일 진실 공급원은 [docs/TravelPack_기획설계서.md](docs/TravelPack_기획설계서.md) — 화면/DB/API/정책 변경 시 문서도 함께 갱신할 것.

## 구조

- `docs/` — 기획·설계서 (v1.2, 오픈 이슈 4건 결정 완료)
- `design/wireframes.html` — 전체 20개 화면 와이어프레임 (브라우저로 열람)
- `design/logo.html` + `design/logo/` — 브랜드 로고("게임팩 × 소풍") SVG 원본·앱 아이콘·워드마크·가이드
- `backend/` — Express + TypeScript + Prisma + PostgreSQL(PostGIS) API 서버
- `admin-web/` — 관리자 웹(CMS), React + Vite + TS. dev 서버가 `/api`를 :4000으로 프록시 (`cd admin-web && npm run dev`, :5173)
- `mobile/` — RN 안드로이드 앱(M3), Expo SDK 56 + TS. 하단탭 5개 + 가이드 모드(expo-location 체크인). API 베이스는 `EXPO_PUBLIC_API_BASE`(기본 10.0.2.2:4000)

## backend 명령어 (cd backend)

```bash
npm run dev          # 개발 서버 (:4000, tsx watch)
npm test             # vitest 통합 테스트 (travelpack_test DB에 migrate deploy 후 실행)
npm run typecheck    # tsc --noEmit
npm run db:migrate   # prisma migrate dev
npm run db:seed      # 제주 시드 (관리자 3계정 + 코스 2개 + 스팟 8곳)
npm run sync:tourapi -- --region=jeju [--types=12,39] [--max=100] [--overview] [--dry-run]   # 관광지
npm run sync:tourapi -- --region=jeju --courses [--max=10] [--dry-run]                        # 여행코스(경유지→좌표 연결)
npm run sync:audioguide -- --region=jeju [--langs=ko,en] [--radius=1000] [--dry-run]          # 오디오 가이드(오디·좌표 매칭)
npm run sync:photos -- --region=jeju [--all] [--dry-run]    # 관광사진(스팟명 키워드 매칭→spot_images)
npm run sync:i18n -- --region=jeju [--all] [--dry-run]      # 영문(EngService2, title 괄호 한글명 매칭→spot_translations)
npm run sync:visitors [-- --dry-run]                        # 지역 방문자수(전국 시도)→region.visitorScore
```

## backend 핵심 규약

- 응답: `{ success: true, data }` / `{ success: false, error: { code, message } }`. BigInt id는 문자열로 직렬화됨
- 모든 async 핸들러는 `h()` 래퍼 필수 (Express 4는 async 에러 미포착)
- 루트 마운트 라우터에 router-level `use(미들웨어)` 금지 — 다른 라우터 경로까지 가로챔. 라우트별로 붙일 것
- 인증: JWT RS256 (keys/ 자동 생성), Refresh는 RTR + 재사용 감지. KV는 REDIS_URL 없으면 인메모리(개발 전용)
- PostGIS: spots.location은 lat/lng 트리거 자동 동기화. 반경 검증은 ST_Distance, 좌표 쓰기는 raw SQL
- 발행 워크플로: DRAFT→IN_REVIEW→PUBLISHED(4-eyes: 작성자≠승인자)→ARCHIVED. 발행 변경 시 캐시 버전 범프
- 관리자 쓰기·개인정보 열람은 logAudit() 필수
- 마켓플레이스: Course에 `authorType`(EDITOR|USER)·`authorUserId`·`price`·`salesCount`, `createdBy` nullable(USER 코스는 null). 이용권은 `course_purchases`(무료/작성자/PAID 구매 시 전체 열람, 그 외 유료는 1일차 미리보기). 페이월은 `/courses/:id`(locked)와 `/trips` 생성 양쪽에서 `courseEntitlement()`로 강제. 결제는 S3/FCM처럼 게이팅(`isPaymentEnabled()`=PG_PROVIDER+PG_API_SECRET, 없으면 유료구매 503·무료 정상). 정산 수수료 `MARKETPLACE_FEE_PERCENT`(기본 20%). USER 코스 발행도 기존 관리자 4-eyes 재사용
- 로컬 DB: Homebrew PostgreSQL 17 + PostGIS (`postgresql://yoon@localhost:5432/travelpack_dev`)

## 남은 작업 (M2 잔여 → M3)

- 관리자 웹(CMS): 코어 완료(인증·대시보드·스팟/코스 CRUD·발행 워크플로·회원/신고/배너), 브라우저 E2E 검증 완료. 잔여 — 푸시 캠페인 UI(백엔드 API는 완료), 코스 미리보기, 감사 로그 뷰어
- TourAPI 동기화 배치: 구현·테스트·라이브 검증 완료(`src/modules/tourapi/`). 관광지 동기화 + **여행코스 import**(areaBasedList2→detailInfo2→detailCommon2로 경유지를 좌표 POI에 연결, DRAFT 코스 생성→에디터 4-eyes 발행). 멱등(코스 보존·스팟 가공필드 보존). 운영 실행은 `TOURAPI_SERVICE_KEY` 필요
- 오디오 가이드(오디·Odii) 동기화: 구현·테스트·라이브 검증 완료(`src/modules/audioguide/`, `npm run sync:audioguide`). 스팟 좌표 반경으로 오디오 스토리 매칭→`audio_guides` 적재, 스팟 상세 응답 `audioGuides[]`, 앱 expo-audio 재생. 동일 `TOURAPI_SERVICE_KEY` 사용(data.go.kr 15101971 활용신청)
- 부가 공공데이터(동일 키, 각 데이터셋 활용신청 필요) — 모두 구현·테스트·라이브 검증:
  - **관광사진**(`src/modules/photos/`, PhotoGalleryService1/gallerySearchList1, 스팟명 키워드 매칭)→`spot_images`(source=PHOTO), 앱 갤러리
  - **영문**(`src/modules/i18n/`, EngService2/areaBasedList2 lDongRegnCd, **영문 title 괄호 속 한글명으로 매칭**—contentId는 한글과 비공유)→`spot_translations`, 스팟 상세 `?lang=en`
  - **지역 방문자수**(`src/modules/visitors/`, DataLabService/metcoRegnVisitrDDList, 외지인+외국인 합)→`region.visitorScore`, 홈 인기지역 정렬·인기 배지. 시도명 부분일치(REGION_AREA.sidoKey, 전북/강원 특별자치도 주의)
- S3 presigned 업로드: 구현 완료(`src/modules/uploads/`, `S3_BUCKET` 없으면 503). FCM 푸시 캠페인: 구현 완료(`src/modules/push/`, 야간 차단·마케팅 미동의 제외, `FCM_PROJECT_ID` 없으면 집계만). 실제 발송은 FCM HTTP v1 자격증명 연결 필요
- 데이터 파기 배치: 구현 완료(`src/modules/retention/`, `npm run purge`, 탈퇴 30일/체크인 좌표 6개월)
- **크리에이터 마켓플레이스(설계서 7장)**: 백엔드 완료. 작성/검수(`src/modules/creator/`, `/me/courses*`), 마켓·이용권·구매·정산(`src/modules/marketplace/`, `/marketplace/courses*`·`/me/purchases`), 페이월(`/courses/:id` locked + `/trips` 게이트), 결제 어댑터 게이팅. 테스트 24개(총 83개). **PG 실연동 코드 완료**(`payment.ts` paymentMode mock|portone|off, PortOne v2 결제검증·환불·웹훅 `POST /marketplace/payments/webhook`). 데모는 `PG_PROVIDER=mock`(비프로덕션)로 즉시승인. 배포: `backend/Dockerfile`·루트 `docker-compose.yml`(풀스택, `docker compose run --rm seed`)·`.github/workflows/ci.yml`·`docs/DEPLOY.md`·`mobile/eas.json`. 법무 초안 `docs/legal/`. 잔여(사용자 오프라인 몫) — 사업자등록·PG 가맹·통신판매업/위치기반서비스 신고·정산 세무·스토어 제출

## mobile (M3) 현황 (cd mobile)

- 핵심 흐름 완료: 홈·탐색(지역→코스목록→코스상세→관광지)·여행시작→가이드 모드(체크인)·저장·MY. 관광지 상세에 **오디오 가이드 플레이어(expo-audio)**. typecheck·Android 번들 통과
- **카카오맵**(`MapView` 추상화, `EXPO_PUBLIC_KAKAO_NATIVE_KEY` 없으면 플레이스홀더), **카카오 소셜 로그인**(`@react-native-kakao/user`→`/auth/social`), **온보딩+약관 동의**(AU-02), **리뷰 작성·북마크 토글** 완료
- **관심테마(ON-02)**: 가입 직후/마이페이지에서 선택→PUT /users/me/interests→홈 개인화. **구글 로그인**: expo-auth-session id_token→/auth/social(EXPO_PUBLIC_GOOGLE_CLIENT_ID 게이트). **FCM 토큰**: 로그인 시 expo-notifications device token→POST /users/me/push-tokens(권한/빌드 없으면 skip). **관광사진 갤러리·홈 인기배지**도 반영
- 지도·소셜·FCM은 카카오/구글 키 + dev build(`npx expo run:android`) 필요. 키 없이도 앱 정상 실행(폴백). app.config.ts가 카카오 키 env 주입
- **카카오맵 한계**: @react-native-kakao/map 2.x는 커스텀 마커/폴리라인 미지원 → 내장 POI 라벨(poiEnabled)만. 번호 마커·경로선은 Kakao JS Maps SDK(WebView+JS키) 별도 필요
- **크리에이터 마켓플레이스 완료**: 마켓 탐색(`MarketplaceScreen`, 홈/탐색 진입), 코스 상세 페이월(잠금 1일차 미리보기 + 구매 CTA·청약철회 고지), 내 여행팩 작성기(`CourseEditorScreen` — 지역·기간·가격·테마·일자별 스팟 선택 모달, 임시저장/검수요청/회수/삭제), 내 코스 목록(`MyCoursesScreen`), 구매함(`MyPurchasesScreen`). MY 탭·홈에서 진입. 스팟 선택은 `GET /spots?regionId=&q=`
- 잔여: 모바일 영문 토글 UI(백엔드 ready), 통합 검색 화면, 카카오맵 커스텀 마커(WebView), 마켓 결제 실연동(PG)
- 명령: `npm run android` / `npm run typecheck` / `npx expo export -p android`
