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
npm run sync:youtube -- --all [--max=8] [--dry-run]         # 유튜브 여행영상(YOUTUBE_API_KEY)→videos·region.buzzScore
```

## backend 핵심 규약

- 응답: `{ success: true, data }` / `{ success: false, error: { code, message } }`. BigInt id는 문자열로 직렬화됨
- 모든 async 핸들러는 `h()` 래퍼 필수 (Express 4는 async 에러 미포착)
- 루트 마운트 라우터에 router-level `use(미들웨어)` 금지 — 다른 라우터 경로까지 가로챔. 라우트별로 붙일 것
- 인증: JWT RS256 (keys/ 자동 생성), Refresh는 RTR + 재사용 감지. KV는 REDIS_URL 없으면 인메모리(개발 전용)
- PostGIS: spots.location은 lat/lng 트리거 자동 동기화. 반경 검증은 ST_Distance, 좌표 쓰기는 raw SQL
- 발행 워크플로: DRAFT→IN_REVIEW→PUBLISHED(4-eyes: 작성자≠승인자)→ARCHIVED. 발행 변경 시 캐시 버전 범프
- 관리자 쓰기·개인정보 열람은 logAudit() 필수
- 마켓플레이스: **v1은 무료 공유 모델**(여행팩 무료 공유·자랑). 유료 결제·이용권·페이월·정산 코드는 **보존된 채 비활성** — 모바일이 가격을 안 보내(price 0)·PG 미설정이라 페이월/구매가 트리거되지 않음. 유료화 시 모바일 가격칸 복원 + `PG_PROVIDER`/`PG_API_SECRET` + price>0 발행으로 재활성. 마켓 인기순은 **saveCount** 기준(판매수는 유료화 시). 스키마/엔드포인트(보존): Course에 `authorType`·`price`·`salesCount`, `course_purchases`(이용권), `courseEntitlement()` 페이월(`/courses/:id` locked + `/trips` 게이트), `isPaymentEnabled()`(mock\|portone), 정산 `MARKETPLACE_FEE_PERCENT`. USER 코스 발행은 관리자 4-eyes 재사용. **테스트는 유료 경로까지 검증(88개)** — 유료 코드가 죽지 않게 유지
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
- **크리에이터 마켓플레이스(설계서 7장)**: 백엔드 완료. 작성/검수(`src/modules/creator/`, `/me/courses*`), 마켓·이용권·구매·정산(`src/modules/marketplace/`, `/marketplace/courses*`·`/me/purchases`), 페이월(`/courses/:id` locked + `/trips` 게이트), 결제 어댑터 게이팅, **관리자 정산 대시보드**(`GET /admin/marketplace/settlements`, admin-web `/settlements`). 테스트 25개(총 84개). **PG 실연동 코드 완료**(`payment.ts` paymentMode mock|portone|off, PortOne v2 결제검증·환불·웹훅 `POST /marketplace/payments/webhook`). 데모는 `PG_PROVIDER=mock`(비프로덕션)로 즉시승인. 배포: `backend/Dockerfile`·루트 `docker-compose.yml`(풀스택, `docker compose run --rm seed`)·`.github/workflows/ci.yml`·`docs/DEPLOY.md`·`mobile/eas.json`. 법무 초안 + **출시 인허가 가이드** `docs/legal/`(위치기반서비스 신고·통신판매업·구글플레이). 사업자: 프로젝트윤(간이과세자, 사업자정보는 `docs/legal/사업자정보.local.md` gitignore). **간이과세자라 통신판매업 신고 현재 면제**. 잔여(사용자 오프라인 몫) — 위치기반서비스사업 신고(방통위, 출시 선행)·스토어 제출·(유료화 시)구글 인앱결제 정책·PG 가맹·정산 세무

## mobile (M3) 현황 (cd mobile)

- 핵심 흐름 완료: 홈·탐색(지역→코스목록→코스상세→관광지)·여행시작→가이드 모드(체크인)·저장·MY. 관광지 상세에 **오디오 가이드 플레이어(expo-audio)**. typecheck·Android 번들 통과
- **카카오맵**(`MapView` 추상화, `EXPO_PUBLIC_KAKAO_NATIVE_KEY` 없으면 플레이스홀더), **카카오 소셜 로그인**(`@react-native-kakao/user`→`/auth/social`), **온보딩+약관 동의**(AU-02), **리뷰 작성·북마크 토글** 완료
- **관심테마(ON-02)**: 가입 직후/마이페이지에서 선택→PUT /users/me/interests→홈 개인화. **구글 로그인**: expo-auth-session id_token→/auth/social(EXPO_PUBLIC_GOOGLE_CLIENT_ID 게이트). **FCM 토큰**: 로그인 시 expo-notifications device token→POST /users/me/push-tokens(권한/빌드 없으면 skip). **관광사진 갤러리·홈 인기배지**도 반영
- 지도·소셜·FCM은 카카오/구글 키 + dev build(`npx expo run:android`) 필요. 키 없이도 앱 정상 실행(폴백). app.config.ts가 카카오 키 env 주입
- **카카오맵**: `MapView`가 3단 폴백 — ① `EXPO_PUBLIC_KAKAO_JS_KEY` 있으면 **WebView+Kakao JS SDK로 번호 마커+경로선**(react-native-webview, Expo Go 동작, 웹 도메인 등록 필요 `EXPO_PUBLIC_KAKAO_MAP_DOMAIN`) ② 네이티브 키만 있으면 내장 POI(@react-native-kakao/map 2.x는 커스텀 마커 미지원) ③ 둘 다 없으면 플레이스홀더
- **커뮤니티 여행팩 공유(무료 v1)**: 둘러보기(`MarketplaceScreen`, 인기순=저장수/최신순), 코스 상세는 무료 전체공개(페이월 코드는 보존·미트리거), 작성기(`CourseEditorScreen` — 가격칸 제거, 지역·기간·테마·일자별 스팟), 내 코스(`MyCoursesScreen`). **홈 재구성**: 큐레이션 "이번 주 추천 코스"가 히어로, 그 아래 "커뮤니티 인기 여행팩" 섹션(USER 코스 saveCount순, 비면 숨김). 구매함 화면은 숨김(유료화 시 복원). 스팟 선택 `GET /spots?regionId=&q=`
- **통합 검색**(`SearchScreen`, 탐색 탭 헤더 검색 아이콘 → `/search` 디바운스, 코스·관광지·지역), **영문 토글**(`SpotDetailScreen` KO/EN → `?lang=en`) 완료
- **유튜브 여행영상 큐레이션**: 백엔드 `src/modules/youtube/`(Data API v3 `sync:youtube`, 음원채널 제외, `videos` 테이블·`region.buzzScore`), home `shortsFeed`·`trendingRegions`, 코스/스팟 상세 `videos[]`. 모바일 `VideoRail`(가로 썸네일 → 탭 시 WebView 인앱 재생, 새 네이티브 의존성 없음), 홈 "🎬 여행 쇼츠"·"🔥 요즘 뜨는 여행지". 184영상 `seed-videos.json` 베이크(라이브 API 없이 재현). `YOUTUBE_API_KEY`는 백엔드 전용(앱 비포함). 지도용 카카오 JS키와 별개
- **코스 상세 사진 슬라이드쇼**(`HeroSlideshow`, 코스 내 관광지 사진 크로스페이드) · **내 여행 빈 화면 CTA**(추천 코스 둘러보기→홈탭) · KTO 코스 테마·인기점수 부여로 홈 추천 24개 실제 코스 노출
- **사업자 정보·약관 화면**(`AboutScreen`, MY 탭·게스트도 접근) — 전자상거래법 §10 신원표시 + 통신판매중개자 고지 + 약관 링크. 값은 `src/legal.ts`가 `EXPO_PUBLIC_BIZ_*`(mobile/.env, gitignore)에서 주입, 약관 전문은 `EXPO_PUBLIC_LEGAL_BASE_URL` 호스팅 링크. 출시 인허가: **위치기반서비스사업 신고 수리 완료 — 신고번호 제1175호(2026-06-15, 방송미디어통신사무소)**(소상공인). 앱/약관/게시본에 `EXPO_PUBLIC_BIZ_LBS_NO=제1175호` 반영. 구글 플레이 자료 `docs/legal/구글플레이_출시자료.md`
- 잔여: 마켓 결제 실연동(PG 보류 중), 카카오맵 WebView는 실기기 렌더 검증 필요(typecheck·번들만 통과)
- 명령: `npm run android` / `npx tsc --noEmit` / `npx expo export -p android`
