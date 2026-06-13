# TravelPack 백엔드 — tsx로 TS 직접 실행(별도 빌드 불필요). Node 22+.
FROM node:22-bookworm-slim

WORKDIR /app

# Prisma 엔진에 openssl 필요
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 의존성 (tsx·prisma CLI 포함이라 dev 포함 설치)
COPY package*.json ./
RUN npm ci

# 소스 + Prisma 클라이언트 생성
COPY . .
RUN npx prisma generate

EXPOSE 4000

# 기동 시 마이그레이션 적용 후 서버 시작. JWT 키(keys/)는 없으면 자동 생성됨.
# (운영에서는 keys/ 를 볼륨/시크릿으로 영속화 권장 — 재배포 시 세션 유지)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
