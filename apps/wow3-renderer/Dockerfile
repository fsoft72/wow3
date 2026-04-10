FROM node:22-slim

# Install Chromium (used by Puppeteer) and FFmpeg
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy workspace manifests for pnpm resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/wow3-renderer/package.json ./apps/wow3-renderer/

# Only package.json needed — renderer does not import @wow/core source
COPY packages/wow-core/package.json ./packages/wow-core/package.json

RUN npm install -g pnpm@10.32.1 && \
    pnpm install --frozen-lockfile --filter @wow/wow3-renderer

# Copy renderer source
COPY apps/wow3-renderer/src ./apps/wow3-renderer/src

# Copy pre-built animation player (must run `pnpm build:animation` before docker build)
COPY apps/wow3-animation/dist ./apps/wow3-animation/dist

VOLUME ["/data"]
EXPOSE 3000

ENV DATA_DIR=/data
ENV PORT=3000

CMD ["node", "apps/wow3-renderer/src/api/app.js"]
