/**
 * Configuration for the optional AI recipe importer.
 *
 * The provider is whatever sits behind an OpenAI-compatible
 * `/chat/completions` endpoint. DeepSeek is the default, so in the common case
 * only `AI_API_KEY` has to be set.
 */

import { AI_API_KEY, AI_BASE_URL, AI_MAX_TOKENS, AI_MODEL, AI_TIMEOUT_MS } from '$app/env/private';

/** DeepSeek's API root. `/chat/completions` is appended by the client. */
const DEFAULT_BASE_URL = 'https://api.deepseek.com';

function intFromEnv(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const baseUrl = (AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/u, '');

export const aiConfig = {
	apiKey: AI_API_KEY || '',
	baseUrl,
	model: AI_MODEL || 'deepseek-chat',
	timeoutMs: intFromEnv(AI_TIMEOUT_MS, 90_000),
	maxTokens: intFromEnv(AI_MAX_TOKENS, 4_096)
} as const;

/** The import feature is hidden/disabled until a key is configured. */
export function isAiConfigured(): boolean {
	return Boolean(aiConfig.apiKey && aiConfig.baseUrl && aiConfig.model);
}

/** Full endpoint URL, exported so tests and diagnostics can show it. */
export function chatCompletionsUrl(): string {
	return `${aiConfig.baseUrl}/chat/completions`;
}
