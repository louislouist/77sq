import { ADSBResponse } from './types/adsb';
import { ADSBQueryType } from './types';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_BACKOFF_MS = 10000;
const USER_AGENT = '77sq/1.0 (ADS-B emergency squawk tracker)';

/**
 * Error that carries HTTP status so the retry loop can decide
 * whether the failure is worth retrying.
 */
class ADSBHttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly retryAfterMs?: number
	) {
		super(`HTTP error! Status: ${status}`);
		this.name = 'ADSBHttpError';
	}
}

/**
 * 4xx responses (except 408 Request Timeout and 429 Too Many Requests)
 * are client errors — retrying won't help.
 */
function isRetryableStatus(status: number): boolean {
	if (status >= 500) return true;
	return status === 408 || status === 429;
}

/** Parse Retry-After header (seconds or HTTP-date) into milliseconds. */
function parseRetryAfterMs(response: Response): number | undefined {
	const header = response.headers.get('retry-after');
	if (!header) return undefined;

	const seconds = Number(header);
	if (!Number.isNaN(seconds)) {
		return seconds * 1000;
	}

	const date = Date.parse(header);
	if (!Number.isNaN(date)) {
		return Math.max(0, date - Date.now());
	}

	return undefined;
}

/** Exponential backoff with jitter: base × 2^(attempt-1), capped, ±25% jitter. */
function backoffDelayMs(baseDelayMs: number, attempt: number): number {
	const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), MAX_BACKOFF_MS);
	const jitter = 0.75 + Math.random() * 0.5; // 0.75 .. 1.25
	return Math.round(exponential * jitter);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchADSB(
	queryType: ADSBQueryType,
	queryValue: string,
	maxRetries: number = 3, // default to 3 retries
	retryDelayMs: number = 500 // base delay for exponential backoff (in ms)
): Promise<ADSBResponse | null> {
	const url = `https://api.adsb.lol/v2/${queryType}/${encodeURIComponent(queryValue)}`;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				headers: { 'User-Agent': USER_AGENT }
			});

			if (!response.ok) {
				throw new ADSBHttpError(response.status, parseRetryAfterMs(response));
			}

			let data: ADSBResponse = await response.json();

			if (!Array.isArray(data.ac)) {
				throw new Error('Unexpected response format: expected an Aircraft array');
			}

			data = updateAcEndpoint(data, queryType);
			return data;

		} catch (error) {
			const status = error instanceof ADSBHttpError ? error.status : undefined;
			const retryable = status === undefined || isRetryableStatus(status);

			console.error(
				`Attempt ${attempt}/${maxRetries} failed to fetch ADS-B data from [${queryType}/${queryValue}]:`,
				error
			);

			// Client errors (4xx) won't get better on retry — fail fast.
			if (!retryable) {
				return null;
			}

			if (attempt >= maxRetries) {
				// All retries exhausted
				return null;
			}

			// 429: honor Retry-After if present, otherwise use backoff.
			const retryAfter = error instanceof ADSBHttpError ? error.retryAfterMs : undefined;
			const delay = retryAfter ?? backoffDelayMs(retryDelayMs, attempt);
			await sleep(delay);
		}
	}
	return null; // fallback, though this line is unlikely to be reached
}

function updateAcEndpoint(response: ADSBResponse, endpoint: string): ADSBResponse {
	if (response.ac && Array.isArray(response.ac)) {
		response.ac.forEach((aircraft) => {
			aircraft.endpoint = endpoint;
		});
	}
	return response;
}
