FROM node:22-slim

# Install Chromium (used by Puppeteer), FFmpeg, and native build tools
# (python3/make/g++ are required to compile better-sqlite3 from source)
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Force native addons (better-sqlite3) to compile from source inside the container
ENV npm_config_build_from_source=true

# Copy workspace manifests for pnpm resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/wow3-renderer/package.json ./apps/wow3-renderer/

# Only package.json needed — renderer does not import @wow/core source
COPY packages/wow-core/package.json ./packages/wow-core/package.json

RUN npm install -g pnpm@10.32.1 node-gyp && \
    pnpm install --frozen-lockfile --filter @wow/wow3-renderer

# Compile better-sqlite3 native bindings for this exact Node.js version.
# pnpm's content-addressable store does not always produce the .node file
# in the right location, so we build it explicitly with node-gyp.
RUN cd /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && \
    node-gyp rebuild --release && \
    ls build/Release/better_sqlite3.node

# Copy renderer source
COPY apps/wow3-renderer/src ./apps/wow3-renderer/src

# Copy pre-built animation player (must run `pnpm build:animation` before docker build)
COPY apps/wow3-animation/dist ./apps/wow3-animation/dist

VOLUME ["/data"]
EXPOSE 4000

ENV DATA_DIR=/data
ENV PORT=4000

CMD ["node", "apps/wow3-renderer/src/api/app.js"]
