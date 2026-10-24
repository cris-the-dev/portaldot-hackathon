# One image per Next.js app: docker build -f deploy/Dockerfile --build-arg PKG=@portalkit/dashboard .
FROM node:24-slim
RUN corepack enable
WORKDIR /app
COPY . .
ARG PKG=@portalkit/dashboard
ARG BASE_PATH=
ARG DEFAULT_CHAIN_ID=
ENV PKG=${PKG} BASE_PATH=${BASE_PATH} NEXT_PUBLIC_DEFAULT_CHAIN_ID=${DEFAULT_CHAIN_ID} NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile && pnpm turbo run build --filter="${PKG}..."
EXPOSE 3000
CMD pnpm -F "$PKG" exec next start --port 3000
