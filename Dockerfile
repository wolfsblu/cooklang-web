# Build stage
FROM node:24-alpine AS builder
WORKDIR /app

# Baked into the server bundle by vite.config.ts so /health can report exactly
# what is running. The workflow passes the release version and checked-out SHA.
ARG APP_VERSION=dev
ARG GIT_SHA=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine

# Same build metadata as the builder, kept as environment variables so it is
# visible with `docker inspect` as well as over /health. Also written as OCI
# labels for registry tooling.
ARG APP_VERSION=dev
ARG GIT_SHA=unknown

LABEL org.opencontainers.image.title="cooklang-web" \
    org.opencontainers.image.description="Self-hosted web app for a Cooklang recipe library" \
    org.opencontainers.image.version="${APP_VERSION}" \
    org.opencontainers.image.revision="${GIT_SHA}" \
    org.opencontainers.image.source="https://github.com/wolfsblu/cooklang-web"

ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA

# Cook CLI version and the checksum of its musl release archive.
#
# The checksum is pinned rather than taken from the .sha256 published beside
# the archive: fetching both from the same place means a re-tagged release
# would verify against its own new checksum and pass silently.
ARG COOK_CLI_VERSION=0.41.1
ARG COOK_CLI_SHA256=342378f8121ba8b12cb13654119348860001bb3ab07ca00ba65f59ad00b51354

WORKDIR /app

# The build output is self-contained: adapter-node bundles every dependency
# into build/, because none of them are production dependencies any more. So
# the runtime stage installs nothing. package.json is copied only so that
# Node resolves the .js files in build/ as ES modules.
COPY package.json ./

COPY --from=builder /app/build ./build

# Checks the CLI behaviour the app depends on. Ships with the image so it can
# be run against the binary that is actually deployed:
#   docker compose run --rm app node scripts/smoke-cook.mjs
COPY scripts ./scripts

# Recipes are deliberately not copied in. Baking them into the image means an
# instance started without a volume serves sample data and writes the shopping
# list and pantry into a container layer, where they are lost on restart.

# Install Cook CLI binary (musl variant, for Alpine)
RUN set -eux; \
    apk add --no-cache --virtual .fetch-deps curl; \
    \
    COOK_URL="https://github.com/cooklang/cookcli/releases/download/v${COOK_CLI_VERSION}/cook-${COOK_CLI_VERSION}-linux-x86_64-musl.tar.gz"; \
    curl -fsSL "${COOK_URL}" -o cook.tar.gz; \
    echo "${COOK_CLI_SHA256}  cook.tar.gz" | sha256sum -c -; \
    \
    tar -xzf cook.tar.gz; \
    mv cook /usr/local/bin/cook; \
    chmod +x /usr/local/bin/cook; \
    cook --version; \
    \
    rm -f cook.tar.gz; \
    apk del .fetch-deps

ENV NODE_ENV=production
ENV PORT=3000
ENV RECIPE_PATH=/app/recipes
# Recipe cover images can be up to 20 MB; adapter-node otherwise rejects any
# request body larger than 512 KB before the action sees it.
ENV BODY_SIZE_LIMIT=25M

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
STOPSIGNAL SIGTERM

# Reports whether the recipe directory is readable and how many recipes were
# found, so a missing volume mount shows up as an unhealthy container rather
# than an empty-looking library.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "build/index.js"]
