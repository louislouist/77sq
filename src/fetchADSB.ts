import { ADSBResponse } from './types/adsb';
import { ADSBQueryType } from './types';

export async function fetchADSBold(): Promise<ADSBResponse | null> {
	const url = 'https://api.adsb.lol/v2/squawk/7700';

	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status} `);
		}

		const data: ADSBResponse = await response.json();

		if (!Array.isArray(data.ac)) {
			throw new Error('Unexpected response format: expected an Aircraft array');
		}

		return data as ADSBResponse;
	} catch (error) {
		console.error('Failed to fetch emergency squawk data:', error);
		return null;
	}
}


export async function fetchADSB(
	queryType: ADSBQueryType,
	queryValue: string,
	maxRetries: number = 3, // default to 3 retries
	retryDelayMs: number = 500 // optional delay between retries (in ms)
): Promise<ADSBResponse | null> {
	const url = `https://api.adsb.lol/v2/${queryType}/${encodeURIComponent(queryValue)}`;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}

			let data: ADSBResponse = await response.json();

			if (!Array.isArray(data.ac)) {
				throw new Error('Unexpected response format: expected an Aircraft array');
			}

			data = updateAcEndpoint(data, queryType);
			return data;

		} catch (error) {
			console.error(
				`Attempt ${attempt} failed to fetch ADS-B data from [${queryType}/${queryValue}]:`,
				error
			);

			if (attempt < maxRetries) {
				// Optional: delay before next retry
				await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
			} else {
				// All retries exhausted
				return null;
			}
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
