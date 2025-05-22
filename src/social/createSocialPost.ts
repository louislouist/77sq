import { writeRandomTextFile } from '../etc/writeRandomTextFile';
import { Aircraft } from '../types/adsb';
import { SquawkText, titleBuilder } from './titleBuilder';

export async function createSocialPost(flight: Aircraft): Promise<string | null> {
	const sqTxt: SquawkText = {
		registration: flight.r,
		equipment: flight.t,
		callsign: flight.flight,
		hex: flight.hex,
		lat: flight.lat ?? flight.rr_lat,
		lon: flight.lon ?? flight.rr_lon
	};

	const postTitle = titleBuilder(sqTxt);

	if (!postTitle) {
		return null;
	} else {
		console.log(postTitle);
		try {
			await writeRandomTextFile(postTitle);
		} catch (err) {
			console.error("Error writing postTitle to file: ", err);
		}
		return postTitle;
	}
}
