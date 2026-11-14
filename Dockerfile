# FastWork - Workflow & Approval Engine
# Build:  docker compose --profile app up -d --build   (xem README, mục "Chạy bằng Docker / deploy")
# Image gồm: Next.js build dạng standalone (chỉ kèm thư viện server thật sự dùng) + Chromium hệ thống
# cho chức năng xuất PDF (puppeteer).

# ---- 1. Cài thư viện ---------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Không tải Chrome đi kèm puppeteer - dùng chromium của hệ điều hành (src/server/utils/chromePath.js)
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# ---- 2. Build ----------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
# BUILD_STANDALONE=1: next.config.mjs bật output "standalone" -> .next/standalone gồm server.js
# và node_modules đã lọc theo những gì server import
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
# Biến NEXT_PUBLIC_* được nhúng vào mã client lúc build
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_COMPANY_NAME=
ARG NEXT_PUBLIC_COMPANY_ADDRESS=
ARG NEXT_PUBLIC_COMPANY_PHONE=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME \
    NEXT_PUBLIC_COMPANY_ADDRESS=$NEXT_PUBLIC_COMPANY_ADDRESS \
    NEXT_PUBLIC_COMPANY_PHONE=$NEXT_PUBLIC_COMPANY_PHONE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/next/dist/bin/next build

# ---- 3. Thư viện cho scripts/ (migrate, seed, demo) - không nằm trong bản standalone ----
FROM node:20-bookworm-slim AS scriptdeps
WORKDIR /deps
COPY package.json ./app-package.json
RUN node -e "const p=require('./app-package.json');const pick=['mysql2','bcryptjs','uuid','dotenv'];\
require('fs').writeFileSync('package.json',JSON.stringify({private:true,dependencies:Object.fromEntries(pick.map(n=>[n,p.dependencies[n]]))}))" \
 && npm install --omit=dev --no-audit --no-fund --no-package-lock

# ---- 4. Chạy -----------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
# chromium + font có dấu tiếng Việt cho PDF; tini để chuyển tín hiệu dừng cho node
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-dejavu-core tini ca-certificates \
 && rm -rf /var/lib/apt/lists/* /usr/share/doc /usr/share/man
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Ho_Chi_Minh \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    STORAGE_DIR=/app/storage/uploads

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/database ./database
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=scriptdeps --chown=node:node /deps/node_modules ./scripts/node_modules
RUN mkdir -p /app/storage/uploads && chown node:node /app/storage /app/storage/uploads

USER node
EXPOSE 3000
VOLUME ["/app/storage/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
# Chờ MySQL -> migrate + seed -> chạy app -> (tuỳ chọn) tạo dữ liệu demo
CMD ["node", "scripts/docker-start.js"]
