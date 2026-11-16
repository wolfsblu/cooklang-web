/**
 * Build metadata reported by /health.
 *
 * Vite replaces the globals at build time with the values passed to the Docker
 * build. The environment variables win at runtime, which makes it possible to
 * override them without rebuilding and keeps the container's declared
 * metadata authoritative.
 */
export const APP_VERSION: string = process.env.APP_VERSION ?? __APP_VERSION__;
export const APP_COMMIT: string = process.env.GIT_SHA ?? __GIT_SHA__;
