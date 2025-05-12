import { argv0 } from "process";
import { fetchADSB } from "./fetchADSB";

let running = true;

interface Tracker {
	hex: string;
	count: number;
	lastSeen: number;  // Unix epoch Date.now();
}

// if lastSeen < oneHourAgo {}

export async function sq77() {
	let tracking: Tracker[] = [];
	while (running) {
		const now = Date.now();
		const oneHourAgo = Date.now() - 60 * 60 * 1000;

		const a77 = await fetchADSB();
		if (a77) {
			console.log(a77);
			a77.ac?.map((ac) => {
				ac.mlat?.map((lat) => {
					console.log(lat);
				})
			})
		}

		// check if both arrays are empty
		if ((!a77?.ac || a77.ac.length === 0) && tracking.length === 0) {
			console.log("No aircraft found & no aircraft being tracked");
		}

		// if nothing is in the ac[] but tracking[] has items, show items.
		// this is to make sure tracking is correctly being allocated.
		if (a77?.ac?.length === 0 && tracking.length > 0) {
			console.log("flight(s) still in tracking:\n");
			tracking.map((ac) => {
				console.log(`   hex: ${ac.hex}, count: ${ac.count}, last seen: ${ac.lastSeen}`);
			})

		}

		// loop through every element in a77.ac to see if it is in tracking.
		if (a77?.ac) {
			a77.ac.forEach((flight) => {
				if (!flight.hex) {
					// write to console and figure out where to write this in the db
					console.log("Flight missing hexCode:\n");
					console.log(flight);
					return;
				}
				// check if flight.hex is in tracking.
				if (tracking.some(tracked => tracked.hex === flight.hex)) {
					// update count and lastSeen
					console.log("updating tracked: ", flight.hex);
					//get index
					const index = tracking.findIndex(tracked => tracked.hex === flight.hex);
					if (index !== -1) {
						tracking[index].count += 1;
						tracking[index].lastSeen = now;
						console.log("updated flight in tracking:\n", tracking[index]);
					}

				} else {
					// flight isn't being tracked and needs to be added to the tracking array.
					tracking.push({
						hex: flight.hex,
						count: 1,
						lastSeen: now,
					})
				}

			})
		}


		// last remove elements from tracking once lastSeen > oneHourAgo.

		if (a77?.ac && a77.ac.length > 0) {
			// get aircraft hexCodes. warn to console if there is no hexCode.
			let hexCodes: string[] = [];
			hexCodes = a77.ac.map((ac) => {
				// handle rare cases of missing hexCode
				if (!ac.hex) {
					console.log("sq77() ac missing hexCode");
					console.log(a77.ac);
					// write to DB
					return undefined;
				}
				return ac.hex;
			}).filter((hex) => hex != undefined);

			// check tracking to see if hexCode exists already
			const inTracking = hexCodes.every(code => tracking.some(tracker => tracker.hex === code))
			if (hexCodes.some(code => tracking.some(tracker => tracker.hex === code))) {
				// if exists, then update count and time

			}
			// if not exitst. add to tracking & run first time events 
		}

		console.log("epoch one hour ago: ", oneHourAgo);

		console.log("sq77() dev mode 10s when nothing in response.ac");
		// if nothing is being tracked in ac, run once a minute. if aircraft are in ac, run every 6 secconds.
		const timeout = (a77?.ac?.length ?? 0) > 0 ? 6000 : 10000; // TODO: change to 60000 in prod.
		await new Promise((resolve) => setTimeout(resolve, timeout));
	}
	console.log("stopped sq77()");
}

export async function stopSq77() {
	running = false;
}
