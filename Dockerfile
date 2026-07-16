# Node.js LTS 경량 이미지 사용
FROM node:18-slim as builder

# 작업 디렉토리 지정
WORKDIR /app

# 의존성 복사 및 설치
COPY package*.json ./
RUN npm ci

# 소스코드 전체 복사 및 Vite 빌드 실행
COPY . .
RUN npm run build

# 실행용 경량 스테이지 구성
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY server.js .
COPY db_cache.json ./db_cache.json

# 포트 개방 및 시작 명령어
EXPOSE 3000
CMD ["npm", "start"]
