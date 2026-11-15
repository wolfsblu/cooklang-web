/**
 * Minimal OpenAI-compatible chat client.
 *
 * The importer needs exactly one thing from the provider -- a chat completion
 * for two messages -- so this avoids an SDK and the dependency surface that
 * comes with one. Any provider that speaks `/chat/completions` with a bearer
 * token works.
 */

import { aiConfig, chatCompletionsUrl, isAiConfigured } from './config.js';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/** A failure the import page can explain to the user. */
export class AiRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AiRequestError';
	}
}

interface ChatCompletionResponse {
	choices?: Array<{
		message?: { content?: unknown };
		finish_reason?: unknown;
	}>;
	error?: { message?: unknown };
}

function providerMessage(body: string): string | null {
	try {
		const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
		const raw = parsed.error?.message ?? parsed.message;
		if (typeof raw !== 'string' || !raw.trim()) return null;
		return raw.trim().slice(0, 300);
	} catch {
		// Providers sometimes return a plain-text error page.
		const text = body.trim();
		return text ? text.slice(0, 300) : null;
	}
}

function decodeContent(content: unknown): string {
	if (typeof content === 'string') return content;

	// A few OpenAI-compatible providers return content parts.
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === 'string') return part;
				if (part && typeof part === 'object' && 'text' in part) {
					const text = (part as { text?: unknown }).text;
					return typeof text === 'string' ? text : '';
				}
				return '';
			})
			.join('');
	}

	return '';
}

/**
 * Ask the model for one completion and return its text.
 *
 * The request is bounded by `AI_TIMEOUT_MS`, and the provider's error body is
 * reduced to a short message: recipe content and the API key never appear in
 * an error surfaced to the client.
 */
export async function chatCompletion(messages: readonly ChatMessage[]): Promise<string> {
	if (!isAiConfigured()) {
		throw new AiRequestError(
			'AI import is not configured. Set AI_API_KEY (and optionally AI_BASE_URL and AI_MODEL) and restart the app.'
		);
	}

	const response = await fetch(chatCompletionsUrl(), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${aiConfig.apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: aiConfig.model,
			messages,
			temperature: 0.2,
			max_tokens: aiConfig.maxTokens,
			stream: false
		}),
		signal: AbortSignal.timeout(aiConfig.timeoutMs)
	}).catch((error: unknown) => {
		if (error instanceof Error && error.name === 'TimeoutError') {
			throw new AiRequestError(
				`The AI provider did not answer within ${Math.round(aiConfig.timeoutMs / 1000)} seconds.`
			);
		}
		throw new AiRequestError(
			`Could not reach the AI provider at ${aiConfig.baseUrl}. Check AI_BASE_URL and the server's network access.`
		);
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		const detail = providerMessage(body);
		throw new AiRequestError(
			`The AI provider returned ${response.status}${detail ? `: ${detail}` : '.'}`
		);
	}

	let payload: ChatCompletionResponse;
	try {
		payload = (await response.json()) as ChatCompletionResponse;
	} catch {
		throw new AiRequestError('The AI provider returned a response that was not valid JSON.');
	}

	if (payload.error) {
		throw new AiRequestError(providerMessage(JSON.stringify(payload)) ?? 'The AI request failed.');
	}

	const choice = payload.choices?.[0];
	const content = decodeContent(choice?.message?.content).trim();

	if (!content) {
		throw new AiRequestError('The AI provider returned an empty recipe.');
	}

	if (choice?.finish_reason === 'length') {
		throw new AiRequestError(
			'The AI response was cut off before the recipe ended. Raise AI_MAX_TOKENS or import a shorter page.'
		);
	}

	return content;
}
