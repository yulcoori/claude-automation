# 모모필라테스 회원 케어 앱
FROM node:20-slim

# Prisma 실행에 필요한 openssl
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# 시작 시 DB 스키마 적용 + 관리자 계정 생성(이미 있으면 건너뜀) 후 서버 실행
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node prisma/seed.mjs && npm start"]
