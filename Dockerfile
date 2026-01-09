# Build stage
FROM node:lts-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:lts-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/recipes ./recipes

# Install production dependencies only
RUN npm ci --omit=dev

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV RECIPE_PATH=./recipes

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "build"]
