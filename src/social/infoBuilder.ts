import { findClosestAirports, loadAirports, Frequency, liveATCExistsByICAO } from 'closest-airport-static-utils';
import { Aircraft } from '../types/adsb';
import { getEmitterCategoryInfo, findDesignationByICAO } from 'icao-designation';

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

	// NOTE: SINGLE \n formting.
	return info.join('\n');
}

function regCallOrHex(ac: Aircraft): string {
	if (!ac.r || !ac.flight) {
		return ac.hex || '';
	}
	return ac.r.trim() || ac.flight.trim();
}


export function buildAircraftInfoTextRMD(aircraft: Aircraft): string {
	// Reddit Markdown version
	// https://support.reddithelp.com/hc/en-us/articles/360043033952-Formatting-Guide
	//

	const info: string[] = [];

	// URL for tracking
	//

	// header 
	info.push(`## **Flight Information: ${regCallOrHex(aircraft)}**`);

	const linkInfo: string[] = [];

	if (aircraft.flight && aircraft.flight != "") {
		const faUrl = getFlightAwareUrl(aircraft.flight);
		linkInfo.push(`[${aircraft.flight.trim()} on FightAware](${faUrl})`);
	}

	if (aircraft.r) {
		const frUrl = getFlightRadar24Url(aircraft.r);
		linkInfo.push(`[${aircraft.r.trim()} on flightradar24](${frUrl})`);
	}

	if (aircraft.hex) {
		const adlolUrl = getAdsbLolUrl(aircraft.hex);
		linkInfo.push(`[${aircraft.hex} on adsb.lol](${adlolUrl})`);
	}

	if (aircraft.lat && aircraft.lon || aircraft.rr_lat && aircraft.rr_lon) {
		const lat = aircraft.lat || aircraft.rr_lat;
		const lon = aircraft.lon || aircraft.rr_lon;
		linkInfo.push(`[OSM Location](https://www.openstreetmap.org/#map=13/${lat}/${lon})`);
	}

	info.push(linkInfo.join(' · '));

	// Aircraft Info
	const acInfo: string[] = [];
	if (aircraft.flight) acInfo.push(`***Flight***: ${aircraft.flight.trim()}`);
	if (aircraft.hex) acInfo.push(`***ICAO Hex***: ${aircraft.hex.trim()}`);
	if (aircraft.r) acInfo.push(`***Registration***: ${aircraft.r.trim()}`);
	info.push(acInfo.join(' '))

	// Aircraft Type :: Catagory writeup.
	if (aircraft.t) {
		const icaoInfo = findDesignationByICAO(aircraft.t);
		let winkInfo = "";

		if (icaoInfo != null) {
			winkInfo = `[${icaoInfo.model}](${icaoInfo.modelLink}) `
		}

		info.push(`***Aircraft***: ${aircraft.t}: ${winkInfo} [doc8643.com](https://www.doc8643.com/aircraft/${aircraft.t})`);
	}

	if (aircraft.category) {
		const categoryDescription = getEmitterCategoryInfo(aircraft.category.trim())
		info.push(`***Category***: ${aircraft.category}: (${categoryDescription})`);
	}

	// Squawk Info
	let sqInfo: string[] = [];
	if (aircraft.squawk) sqInfo.push(`***Squawk***: ${aircraft.squawk}`);
	if (aircraft.emergency) sqInfo.push(`***Emergency***: ${aircraft.emergency}`);
	if (aircraft.type) sqInfo.push(`***Message Type***: *${aircraft.type}*`);
	info.push(sqInfo.join(" "));

	info.push("## **Current Status:**")
	if (aircraft.alt_baro !== undefined) {
		if (aircraft.alt_baro === "ground") {
			info.push("***Altitude (Baro)***: Aircraft Landed");
		} else {
			info.push(`***Altitude (Baro)***: ${aircraft.alt_baro} ft`);
		}
	}
	if (aircraft.alt_geom !== undefined) info.push(`***Altitude (Geom)***: ${aircraft.alt_geom} ft`);
	if (aircraft.gs !== undefined) info.push(`***Ground Speed***: ${aircraft.gs} knots`);
	if (aircraft.track !== undefined) info.push(`***Track***: ${aircraft.track}°`);
	if (aircraft.baro_rate !== undefined) info.push(`***Climb/Descent Rate***: ${aircraft.baro_rate} ft/min`);
	if (aircraft.nav_modes && aircraft.nav_modes.length > 0) {
		info.push(`***Autopilot Modes***: ${aircraft.nav_modes.join(', ')}`);
	}

	// Location Info
	// TODO: write func to handle lat, rr_lat, lon, rr_lon.
	// deal with building freq table: 
	// Type | Description | Freq.
	// ---- | ----- | -----
	// needs seperate push before return due to newline formatting.
	const airportInfo: string[] = [];
	if (aircraft.lat !== undefined && aircraft.lon !== undefined) {
		info.push(`***Position***: ${aircraft.lat.toFixed(4)}, ${aircraft.lon.toFixed(4)}\n`);
		const airportData = getAirportInfo(aircraft.lat, aircraft.lon);
		airportData.forEach((line) => {
			airportInfo.push(line);
		});
	} else if (aircraft.rr_lon !== undefined && aircraft.rr_lon !== undefined) {
		info.push(`***Rough Position***: ${aircraft.rr_lat.toFixed(4)}, ${aircraft.rr_lon.toFixed(4)}\n`);
		const airportData = getAirportInfo(aircraft.rr_lat, aircraft.rr_lon);
		airportData.forEach((line) => {
			airportInfo.push(line);
		});
	}

	// NOTE: double \n for reddit formting. no join for airport data.
	const redditPost = info.join('\n\n') + airportInfo.join('\n');

	return redditPost;
}
function getAirportInfo(lat: number, lon: number): string[] {
	const closest = findClosestAirports(lat, lon, loadAirports(), 3);
	const airportInfo: string[] = [];

	if (!closest || !Array.isArray(closest)) {
		return ["*Invalid airport data.*\n"];
	}

	airportInfo.push("## **Nearby Airport(s) and Frequencies:**\n");

	if (closest.length > 0) {
		closest.forEach(airport => {
			const icaoName = airport.icao;
			airportInfo.push(`### ***${airport.name} (${airport.iata || airport.icao})***`);
			if (airport.wikipedia) {
				airportInfo.push(` [${airport.iata || airport.icao} Wikipedia](${airport.wikipedia})\n`)
			}
			if (icaoName && icaoName.trim() !== "") {
				// NOTE: MD for reddit
				//
				// check if icao is in live atc
				if (liveATCExistsByICAO(icaoName.trim())) {
					airportInfo.push(` [LiveATC @${icaoName}](http://www.liveatc.net/search/?icao=${icaoName})\n`);
				}
			} else {
				airportInfo.push('\n')
			}
			airportInfo.push(`***Location***: ${airport.regionName}`);
			airportInfo.push(` (${airport.country})\n`)
			airportInfo.push(`***Frequencies***:\n`);
			if (airport.frequencies) {
				const apFreqs = formatFrequenciesReddit(airport.frequencies);
				airportInfo.push(apFreqs);
			}
		});
	} else {
		airportInfo.push("*...no airport information.*\n");
	}

	return airportInfo;

}

export function formatFrequenciesReddit(frequencies: Frequency[]): string {
	if (!frequencies || frequencies.length === 0) {
		return '*No radio information*\n';
	}

	const tableRows: string[] = [];
	const header = "| Type | Description | Frequency |";
	const markerRow = "|:------:|:------------:|:---------------:";

	tableRows.push(header);
	tableRows.push(markerRow);

	frequencies.forEach((freq) => {
		const freqRow = `| ${freq.type} | (${freq.description || 'N/A'}) | ${freq.mhz} MHz |`;
		tableRows.push(freqRow);
	})

	return '\n' + tableRows.join('\n') + '\n';
}

// URL builders
//
function getFlightRadar24Url(ac: string): string {
	// callsign or registration
	const acTrimmed = ac.trim();
	return `https://www.flightradar24.com/${acTrimmed}`;
}

function getFlightAwareUrl(ac: string): string {
	const acTrimmed = ac.trim();
	return `https://www.flightaware.com/live/flight/${acTrimmed}`;
}

function getAdsbLolUrl(ac: string): string {
	// tested for hex code
	const acTrimmed = ac.trim();
	return `https://adsb.lol/?icao=${acTrimmed}`;
}
