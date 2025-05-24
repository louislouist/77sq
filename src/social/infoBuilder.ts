import { findClosestAirports, loadAirports } from 'closest-airport-static-utils';
import { Aircraft } from '../types/adsb';

export function buildAircraftInfoText(aircraft: Aircraft): string {
	const info: string[] = [];

	// URL for tracking
	//
	if (aircraft.r || aircraft.flight) {
		const acName = aircraft.r ?? aircraft.flight;
		if (acName) {
			const frUrl = getFlightRadar24Url(acName);
			info.push(`[${acName} on flightradar24](${frUrl})`);
		}
	} else if (aircraft.hex !== undefined) {
		const alolUrl = getAdsbLolUrl(aircraft.hex);
		info.push(`[${aircraft.hex} on adsb.lol](${alolUrl})`);
	}

	// Aircraft Info
	if (aircraft.flight) info.push(`Flight: ${aircraft.flight}`);
	if (aircraft.hex) info.push(`ICAO Hex: ${aircraft.hex}`);
	if (aircraft.r) info.push(`Registration: ${aircraft.r}`);

	// Aircraft Type 
	if (aircraft.t) info.push(`Aircraft: ${aircraft.t}`);

	if (aircraft.type) info.push(`Message Type: ${aircraft.type}`);
	if (aircraft.alt_baro !== undefined) info.push(`Altitude (Baro): ${aircraft.alt_baro} ft`);
	if (aircraft.alt_geom !== undefined) info.push(`Altitude (Geom): ${aircraft.alt_geom} ft`);
	if (aircraft.gs !== undefined) info.push(`Ground Speed: ${aircraft.gs} knots`);
	if (aircraft.track !== undefined) info.push(`Track: ${aircraft.track}°`);
	if (aircraft.baro_rate !== undefined) info.push(`Climb/Descent Rate: ${aircraft.baro_rate} ft/min`);
	if (aircraft.nav_modes && aircraft.nav_modes.length > 0) {
		info.push(`Autopilot Modes: ${aircraft.nav_modes.join(', ')}`);
	}

	// Squawk Info
	let sqInfo: string[] = [];
	if (aircraft.squawk) sqInfo.push(`Squawk: ${aircraft.squawk}`);
	if (aircraft.emergency) sqInfo.push(`Emergency: ${aircraft.emergency}`);
	if (aircraft.category) sqInfo.push(`Category: ${aircraft.category}`);
	info.push(sqInfo.join(" "));

	// Location Info
	if (aircraft.lat !== undefined && aircraft.lon !== undefined) {
		info.push(`Position: ${aircraft.lat.toFixed(4)}, ${aircraft.lon.toFixed(4)}`);
		const airportData = getAirportInfo(aircraft.lat, aircraft.lon);
		airportData.forEach((line) => {
			info.push(line);
		});
	} else {
		info.push(`Rough Position: ${aircraft.rr_lat.toFixed(4)}, ${aircraft.rr_lon.toFixed(4)}`);
		const airportData = getAirportInfo(aircraft.rr_lat, aircraft.rr_lon);
		airportData.forEach((line) => {
			info.push(line);
		});
	}

	// if (aircraft.messages !== undefined) info.push(`Messages Received: ${aircraft.messages}`);
	// if (aircraft.seen !== undefined) info.push(`Last Seen: ${aircraft.seen} sec ago`);
	// if (aircraft.rssi !== undefined) info.push(`Signal Strength: ${aircraft.rssi}`);

	// NOTE: double \n for reddit formting.
	return info.join('\n\n');
}


export function buildAircraftInfoTextRMD(aircraft: Aircraft): string {
	// Reddit Markdown version
	// https://support.reddithelp.com/hc/en-us/articles/360043033952-Formatting-Guide
	//

	const info: string[] = [];

	// URL for tracking
	//
	if (aircraft.r || aircraft.flight) {
		const acName = aircraft.r ?? aircraft.flight;
		if (acName) {
			info.push(`## **Flight Information: ${acName.trim()}**`)
			const frUrl = getFlightRadar24Url(acName);
			info.push(`[${acName} on flightradar24](${frUrl})`);
		}
	} else if (aircraft.hex !== undefined) {
		const alolUrl = getAdsbLolUrl(aircraft.hex);
		info.push(`[${aircraft.hex} on adsb.lol](${alolUrl})`);
	}

	// Aircraft Info
	if (aircraft.flight) info.push(`***Flight***: ${aircraft.flight}`);
	if (aircraft.hex) info.push(`***ICAO Hex***: ${aircraft.hex}`);
	if (aircraft.r) info.push(`***Registration***: ${aircraft.r}`);

	// Aircraft Type :: Catagory writeup.
	if (aircraft.t) info.push(`***Aircraft***: ${aircraft.t}`);
	if (aircraft.category) info.push(`***Category***: ${aircraft.category}`);

	// Squawk Info
	let sqInfo: string[] = [];
	if (aircraft.squawk) sqInfo.push(`***Squawk***: ${aircraft.squawk}`);
	if (aircraft.emergency) sqInfo.push(`Emergency: ${aircraft.emergency}`);
	info.push(sqInfo.join(" "));
	if (aircraft.type) info.push(`Message Type: *${aircraft.type}*`);

	info.push("## **Current Status:**")
	if (aircraft.alt_baro !== undefined) info.push(`***Altitude (Baro)***: ${aircraft.alt_baro} ft`);
	if (aircraft.alt_geom !== undefined) info.push(`***Altitude (Geom)***: ${aircraft.alt_geom} ft`);
	if (aircraft.gs !== undefined) info.push(`***Ground Speed***: ${aircraft.gs} knots`);
	if (aircraft.track !== undefined) info.push(`***Track***: ${aircraft.track}°`);
	if (aircraft.baro_rate !== undefined) info.push(`***Climb/Descent Rate***: ${aircraft.baro_rate} ft/min`);
	if (aircraft.nav_modes && aircraft.nav_modes.length > 0) {
		info.push(`***Autopilot Modes***: ${aircraft.nav_modes.join(', ')}`);
	}

	// Location Info
	if (aircraft.lat !== undefined && aircraft.lon !== undefined) {
		info.push(`***Position***: ${aircraft.lat.toFixed(4)}, ${aircraft.lon.toFixed(4)}`);
		const airportData = getAirportInfo(aircraft.lat, aircraft.lon);
		airportData.forEach((line) => {
			info.push(line);
		});
	} else {
		info.push(`***Rough Position***: ${aircraft.rr_lat.toFixed(4)}, ${aircraft.rr_lon.toFixed(4)}`);
		const airportData = getAirportInfo(aircraft.rr_lat, aircraft.rr_lon);
		airportData.forEach((line) => {
			info.push(line);
		});
	}

	// if (aircraft.messages !== undefined) info.push(`Messages Received: ${aircraft.messages}`);
	// if (aircraft.seen !== undefined) info.push(`Last Seen: ${aircraft.seen} sec ago`);
	// if (aircraft.rssi !== undefined) info.push(`Signal Strength: ${aircraft.rssi}`);

	// NOTE: double \n for reddit formting.
	return info.join('\n\n');
}
function getAirportInfo(lat: number, lon: number): string[] {
	const closest = findClosestAirports(lat, lon, loadAirports(), 3);
	const airportInfo: string[] = [];

	if (!closest || !Array.isArray(closest)) {
		return ["*Invalid airport data.*"];
	}

	airportInfo.push("## **Nearby Airport(s) and Frequencies:**")

	if (closest.length > 0) {
		closest.forEach(airport => {
			const icaoName = airport.icao;
			airportInfo.push(`### ***${airport.name} (${airport.iata || airport.icao})***`);
			if (icaoName && icaoName.trim() !== "") {
				// NOTE: MD for reddit
				airportInfo.push(`[LiveATC @${icaoName}](http://www.liveatc.net/search/?icao=${icaoName})`);
			}
			airportInfo.push(`***Region***: ${airport.regionName}`);
			airportInfo.push(`***Frequencies***:`);
			if (airport.frequencies && airport.frequencies.length > 0) {
				airport.frequencies.slice(0, 3).forEach(f => {
					airportInfo.push(`* ${f.type} (${f.description}): *${f.mhz} MHz*`);
				});
			}
		});
	} else {
		airportInfo.push("*...no airport information.*");
	}

	return airportInfo;

}

function getFlightRadar24Url(ac: string): string {
	// callsign or registration
	const acTrimmed = ac.trim();
	return `https://www.flightradar24.com/${ac}`;
}

function getAdsbLolUrl(ac: string): string {
	// tested for hex code
	const acTrimmed = ac.trim();
	return `https://adsb.lol/?icao=${acTrimmed}`;
}
