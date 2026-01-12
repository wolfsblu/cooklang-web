# Build stage
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine

# Cook CLI version (can be overridden at build time)
ARG COOK_CLI_VERSION=0.19.3

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build ./build
COPY --from=builder /app/recipes ./recipes

# Install Cook CLI binary
# Using musl variant for Alpine Linux compatibility
RUN set -eux; \
    # Install curl for downloading
    apk add --no-cache curl; \
    \
    COOK_ARCH="x86_64-unknown-linux-musl"; \
    COOK_URL="https://github.com/cooklang/cookcli/releases/download/v${COOK_CLI_VERSION}/cook-${COOK_ARCH}.tar.gz"; \
    COOK_SHA_URL="${COOK_URL}.sha256"; \
    \
    # Download binary and checksum
    curl -fsSL "${COOK_URL}" -o cook.tar.gz; \
    curl -fsSL "${COOK_SHA_URL}" -o cook.tar.gz.sha256.orig; \
    \
    # Verify checksum (extract hash and create proper format for our filename)
    EXPECTED_SHA=$(cat cook.tar.gz.sha256.orig | awk '{print $1}'); \
    echo "${EXPECTED_SHA}  cook.tar.gz" > cook.tar.gz.sha256; \
    sha256sum -c cook.tar.gz.sha256; \
    \
    # Extract and install
    tar -xzf cook.tar.gz; \
    mv cook /usr/local/bin/cook; \
    chmod +x /usr/local/bin/cook; \
    \
    # Verify installation
    cook --version; \
    \
    # Clean up
    rm -f cook.tar.gz cook.tar.gz.sha256 cook.tar.gz.sha256.orig

ENV NODE_ENV=production
ENV PORT=3000
ENV RECIPE_PATH=/app/recipes

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "build/index.js"]