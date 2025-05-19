// Squwak 7700 {type} emergency. Registration {r}: ({t}): Call sign: {flight}: Near {city} (hex if no r or call.)

interface SquawkText {
	registration?: string;
	equipment?: string;
	callsign?: string;
	hex?: string;
	lat?: number;
	lon?: number;
}

function titleBuilder(aircraft: SquawkText): string | null {
	if (!aircraft.hex && !aircraft.registration && !aircraft.callsign) {
		return null;
	}

	const title: string[] = [];

	title.push("Squawk 7700 ");

	if (aircraft.registration) {
		title.push(`${aircraft.registration} `);
	}

	if (aircraft.callsign) {
		title.push(`callsign: ${aircraft.callsign} `);
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
	}

	title.push('repoted.');

	return title.join("");
}
