# Build stage
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build ./build
COPY --from=builder /app/recipes ./recipes

ENV NODE_ENV=production
ENV PORT=3000
ENV RECIPE_PATH=/app/recipes

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "build/index.js"]