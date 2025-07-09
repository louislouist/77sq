import { findClosestAirports, liveATCExistsByICAO } from "closest-airport-static-utils"
import { Aircraft } from "../types";


export async function closestAirportInfo(lat: number, lon: number): Promise<string> {
	const closestResult = findClosestAirports(lat, lon, 1, ['large_airport']);

	const airport = closestResult[0];

	const nameIcao = airport.icao;
	const nameIata = airport.iata;
	const regionCode = airport.regionInfo?.code;
	const inLiveATC = liveATCExistsByICAO(nameIcao);


	let airportInfo: string[] = [];

	if (nameIata && nameIcao) {
		airportInfo.push(`${nameIata}/${nameIcao}`);
	} else if (nameIata) {
		airportInfo.push(nameIata);
	} else {
		airportInfo.push(nameIcao);
	}

	airportInfo.push(`(${regionCode})`);

	if (inLiveATC) {
		airportInfo.push(`LiveATC`);
	}

	return airportInfo.join(' ');

}

export async function infoAircraft(ac: Aircraft): Promise<string> {
	let acInfo: string[] = [];

	const hex = ac.hex;
	const callsign = ac.flight;
	const reg = ac.r;
	const sq = ac.squawk;
	const lat = ac.lat ?? ac.rr_lat;
	const lon = ac.lon ?? ac.rr_lon;

	if (sq) acInfo.push(`squawk: ${sq}`);
	if (callsign) acInfo.push(`${callsign.trim()}`);
	if (reg) acInfo.push(`reg: ${reg.trim()}`);
	if (hex) acInfo.push(`hex: ${hex.trim()}`);
	if (ac.t) acInfo.push(`(${ac.t})`);
	if (ac.alt_baro) acInfo.push(`alt: ${ac.alt_baro}`);
	if (ac.baro_rate) acInfo.push(`${ac.baro_rate} ft/min`);
	if (ac.track) acInfo.push(`heading: ${ac.track}°`);

	// Get and log closest airport info
	if (lat && lon) {
		const airport = await closestAirportInfo(lat, lon);
		if (airport) {
			acInfo.push(`${airport}`);
		}
	}

	return acInfo.join(' ');
}
