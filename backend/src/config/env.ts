import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/travelpack_dev'),
  TEST_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional().or(z.literal('')),
  JWT_PRIVATE_KEY_PATH: z.string().default('keys/private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('keys/public.pem'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().default(1800),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(14),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal('')),
  KAKAO_ENABLED: z.coerce.boolean().default(true),
  TOURAPI_SERVICE_KEY: z.string().optional().or(z.literal('')),
  // YouTube Data API v3 (여행영상 큐레이션 sync) — 비우면 sync:youtube 스킵
  YOUTUBE_API_KEY: z.string().optional().or(z.literal('')),
  // Gemini API (영상→코스 자동생성: 캡션에서 장소 추출) — 비우면 from-video 503
  GEMINI_API_KEY: z.string().optional().or(z.literal('')),
  // Kakao 로컬(장소검색) REST 키 — 맛집·카페 좌표. 비우면 TourAPI 폴백
  KAKAO_REST_API_KEY: z.string().optional().or(z.literal('')),
  RATE_LIMIT_GUEST_PER_MIN: z.coerce.number().default(30),
  RATE_LIMIT_USER_PER_MIN: z.coerce.number().default(60),
  // S3 업로드 (비우면 /uploads/presigned-url 503)
  AWS_REGION: z.string().default('ap-northeast-2'),
  S3_BUCKET: z.string().optional().or(z.literal('')),
  S3_PUBLIC_BASE_URL: z.string().optional().or(z.literal('')), // CloudFront 도메인. 비우면 S3 URL 사용
  // FCM 푸시 (비우면 실제 발송 없이 수신자 집계만)
  FCM_PROJECT_ID: z.string().optional().or(z.literal('')),
  // 마켓플레이스 결제 PG (비우면 유료 코스 구매 503, 무료 코스는 정상)
  PG_PROVIDER: z.string().optional().or(z.literal('')), // mock(개발) | portone
  PG_API_SECRET: z.string().optional().or(z.literal('')),
  PORTONE_WEBHOOK_SECRET: z.string().optional().or(z.literal('')), // PortOne 웹훅 서명 검증용
  // 플랫폼 수수료율(%) — 정산 시 크리에이터 몫 = 가격 × (1 - 수수료율)
  MARKETPLACE_FEE_PERCENT: z.coerce.number().min(0).max(100).default(20),
})

export const env = schema.parse(process.env)
export const isTest = env.NODE_ENV === 'test'
export const isProd = env.NODE_ENV === 'production'
