import { findClosestAirports, loadAirports } from 'closest-airport-static-utils';

// Squwak 7700 {type} emergency. Registration {r}: ({t}): Call sign: {flight}: Near {city} (hex if no r or call.)

export interface SquawkText {
	registration?: string;
	equipment?: string;
	callsign?: string;
	hex?: string;
	lat?: number;
	lon?: number;
}
export function titleBuilder(aircraft: SquawkText): string | null {
	if (!aircraft.hex && !aircraft.registration && !aircraft.callsign) {
		return null;
	}

	const title: string[] = [];

	title.push("Squawk 7700 ");

	if (aircraft.registration) {
		title.push(`${aircraft.registration} `);
	}

	if (aircraft.callsign) {
		// TODO: see if this covers the cases where callsign is showing up without a string.
		// belt & suspenders. 
		const rawCallsign = aircraft.callsign;

		if (typeof rawCallsign === "string") {
			const trimmedCallsign = rawCallsign.trim();
			if (trimmedCallsign.length > 0) {
				title.push(`callsign: ${trimmedCallsign} `);
			}
		}
	}

	if (!aircraft.registration && !aircraft.callsign) {
		title.push(`hex code: ${aircraft.hex} `)
	} else {
		title.push(`hex: ${aircraft.hex} `)
	}

	if (aircraft.equipment) {
		title.push(`(${aircraft.equipment}) `);
	}

	if (aircraft.lat != null && aircraft.lon != null) {
		// query closest city.
		const nearport = largeAirportInfo(aircraft.lat, aircraft.lon);
		title.push(`near: ${nearport} `);
	}

	title.push('reported.');

	return title.join("");
}

function largeAirportInfo(lat: number, lon: number): string {
	const airports = loadAirports();
	const firstLargeAirport = findClosestAirports(lat, lon, airports, 1, ['large_airport']);

	const airportInfo: string[] = []

	if (firstLargeAirport[0].icao) {
		airportInfo.push(`${firstLargeAirport[0].icao}`);
	}

	if (firstLargeAirport[0].name) {
		airportInfo.push(`: ${firstLargeAirport[0].name}`);
	}

	if (airportInfo.length > 0) {
		return airportInfo.join("");
	} else {
		return `lat: ${lat}, lon: ${lon}`
	}

}
