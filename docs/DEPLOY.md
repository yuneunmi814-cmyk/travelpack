# 배포 & 체험 가이드

## A. 체험용 — 한 번에 전체 띄우기 (Docker)

로컬에 Docker만 있으면 DB·Redis·백엔드가 한 번에 뜹니다.

```bash
# 1) 전체 기동 (이미지 빌드 포함)
docker compose up -d --build

# 2) 시드 데이터 (제주: 관리자 3계정 + 코스 2개 + 스팟 8곳)
docker compose run --rm seed

# 3) 확인
curl http://localhost:4000/health          # {"ok":true}
curl http://localhost:4000/api/v1/home     # 홈 피드

# 로그 / 정지
docker compose logs -f backend
docker compose down            # 데이터 유지 / down -v 면 DB까지 삭제
```

- 데모는 `NODE_ENV=development` + `PG_PROVIDER=mock` 이라 **유료 코스 구매도 즉시 승인**됩니다(실제 결제 X).
- TourAPI 동기화까지 보려면: `TOURAPI_SERVICE_KEY=... docker compose run --rm backend npm run sync:tourapi -- --region=jeju --courses`

### 앱(모바일)을 이 백엔드에 붙이기
```bash
cd mobile && npm install
# 에뮬레이터: 기본값(10.0.2.2:4000) 그대로. 실기기: PC LAN IP로
EXPO_PUBLIC_API_BASE=http://<PC-IP>:4000/api/v1 npm run android
```

### 관리자 웹(CMS)
```bash
cd admin-web && npm install && npm run dev   # http://localhost:5173 (/api → :4000 프록시)
# 시드 계정: super@travelpack.app / travelpack-dev-1234
```

---

## B. 정식 배포

### 백엔드
- **DB**: PostGIS 지원 매니지드 Postgres 필요 — Supabase·Neon·AWS RDS(+PostGIS 확장). `DATABASE_URL` 설정.
- **Redis**: 운영은 필수(`REDIS_URL`). 미설정 시 인메모리 폴백(단일 인스턴스 개발용).
- **앱 호스팅**: `backend/Dockerfile`로 어디서나 — Render·Railway·Fly.io·ECS 등.
  - 기동 시 `prisma migrate deploy` 자동 실행.
  - **JWT 키**: `keys/` 는 없으면 자동 생성됨. 재배포 시 세션 유지하려면 볼륨/시크릿으로 영속화하거나 `npm run keys:gen` 결과를 시크릿으로 주입.
- **필수 환경변수**: `DATABASE_URL`, `REDIS_URL`, `NODE_ENV=production`. 기능별: `TOURAPI_SERVICE_KEY`, `S3_BUCKET`/`AWS_*`, `FCM_PROJECT_ID`, `PG_PROVIDER=portone`+`PG_API_SECRET`+`PORTONE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`.
- `NODE_ENV=production`에서는 `PG_PROVIDER=mock` 이 비활성(off)됩니다 — 운영 결제는 반드시 실 PG.

### 결제(PortOne) 연결
1. PortOne 콘솔에서 채널·V2 API 시크릿 발급 → `PG_PROVIDER=portone`, `PG_API_SECRET=...`.
2. 웹훅 URL `https://<api>/api/v1/marketplace/payments/webhook` 등록 → `PORTONE_WEBHOOK_SECRET=...`.
3. 모바일: PortOne RN SDK로 결제 후 받은 `paymentId`를 `POST /marketplace/courses/:id/purchase` 본문에 실어 보내면 서버가 금액 대조 검증 후 이용권 부여(코드 준비됨).

### 모바일 빌드/출시 (EAS)
```bash
cd mobile
npm i -g eas-cli && eas login
eas build --profile preview   --platform android   # 내부 테스트 APK
eas build --profile production --platform android   # 스토어용 AAB
eas submit --profile production --platform android   # Play Console 업로드
```
- 키(`EXPO_PUBLIC_KAKAO_NATIVE_KEY`·`EXPO_PUBLIC_GOOGLE_*`)는 **EAS Secret** 또는 `eas.json`의 `env`로 주입.
- 릴리스 서명키의 SHA-1을 카카오/구글 콘솔에 등록해야 지도·소셜 로그인이 동작.

### CI
`.github/workflows/ci.yml` — push/PR 시 백엔드(typecheck+테스트 79+개, PostGIS 서비스 컨테이너), 모바일(tsc), admin-web(build)를 자동 검증.

---

## 출시 전 법무 체크 (사업자 본인)
`docs/legal/README.md` 참조 — 위치기반서비스사업 신고·통신판매업·개인정보처리방침·청약철회 정책.
