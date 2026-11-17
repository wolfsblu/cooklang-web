/**
 * Configuration for the optional AI recipe importer.
 *
 * The provider is whatever sits behind an OpenAI-compatible
 * `/chat/completions` endpoint. DeepSeek is the default, so in the common case
 * only `AI_TEXT_API_KEY` has to be set.
 *
 * URL imports use the text model. Photo imports use a separately configured
 * vision model (`AI_VISION_MODEL`, with optional `AI_VISION_BASE_URL` and
 * `AI_VISION_API_KEY` overrides) because the default text model cannot read
 * images, and because the vision model often lives on a different provider.
 *
 * The older `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` names are still read as
 * fallbacks for the text settings so existing deployments keep working.
 */

import {
	AI_API_KEY,
	AI_BASE_URL,
	AI_MODEL,
	AI_TEXT_API_KEY,
	AI_TEXT_BASE_URL,
	AI_TEXT_MODEL,
	AI_MAX_TOKENS,
	AI_TIMEOUT_MS,
	AI_VISION_API_KEY,
	AI_VISION_BASE_URL,
	AI_VISION_MODEL
} from '$app/env/private';

/** DeepSeek's API root. `/chat/completions` is appended by the client. */
const DEFAULT_BASE_URL = 'https://api.deepseek.com';

function intFromEnv(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function apiRoot(value: string | undefined, fallback: string): string {
	return (value || fallback).replace(/\/+$/u, '');
}

const baseUrl = apiRoot(AI_TEXT_BASE_URL || AI_BASE_URL, DEFAULT_BASE_URL);
const timeoutMs = intFromEnv(AI_TIMEOUT_MS, 90_000);
const maxTokens = intFromEnv(AI_MAX_TOKENS, 4_096);

export const aiConfig = {
	apiKey: AI_TEXT_API_KEY || AI_API_KEY || '',
	baseUrl,
	model: AI_TEXT_MODEL || AI_MODEL || 'deepseek-chat',
	timeoutMs,
	maxTokens
} as const;

/**
 * Configuration for reading a recipe out of a photo.
 *
 * The base URL and key fall back to the text configuration, so a single
 * provider can serve both. `model` has no fallback: photo import is only
 * offered when an explicitly vision-capable model is named.
 */
export const aiVisionConfig = {
	apiKey: AI_VISION_API_KEY || aiConfig.apiKey,
	baseUrl: apiRoot(AI_VISION_BASE_URL, aiConfig.baseUrl),
	model: AI_VISION_MODEL || '',
	timeoutMs: aiConfig.timeoutMs,
	maxTokens: aiConfig.maxTokens
} as const;

/** The URL import feature is hidden/disabled until a key is configured. */
export function isAiConfigured(): boolean {
	return Boolean(aiConfig.apiKey && aiConfig.baseUrl && aiConfig.model);
}

/** Photo import needs a key, a root and an explicitly named vision model. */
export function isVisionConfigured(): boolean {
	return Boolean(aiVisionConfig.apiKey && aiVisionConfig.baseUrl && aiVisionConfig.model);
}

/** Full endpoint URL, exported so tests and diagnostics can show it. */
export function chatCompletionsUrl(baseUrl = aiConfig.baseUrl): string {
	return `${baseUrl}/chat/completions`;
}
