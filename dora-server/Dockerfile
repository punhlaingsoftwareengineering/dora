# ---------- Build stage ----------
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable

# GitHub Packages auth for @menzies-mariesta-com (set via Fly build secret / --build-arg)
ARG NODE_AUTH_TOKEN
ENV NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# allowBuilds.esbuild=true in pnpm-workspace.yaml permits esbuild install scripts
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec svelte-kit sync \
	&& pnpm run build \
	&& pnpm prune --prod --ignore-scripts


# ---------- Runtime stage ----------
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production
ENV PORT=5173
ENV NODE_OPTIONS=--max-old-space-size=768

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5173

CMD ["node", "build"]
