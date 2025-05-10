import { ADSBResponse } from './types/adsb';

export async function fetchADSB(): Promise<ADSBResponse | null> {
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
