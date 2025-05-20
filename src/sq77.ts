import { fetchADSB } from "./fetchADSB";
import { formatDateEpoch } from "./etc/Dates";
import { v4 as uuidv4 } from 'uuid';
import { dbSingleAircraftTracking } from "./db/dbSingleAircraftTracking";
import { Database } from "sqlite";
import { dbQueue } from "./db/queue/dbQueue";
import { SquawkText, titleBuilder } from "./social/titleBuilder";

let running = true;

interface Tracker {
	id: string;
	hex: string;
	count: number;
	lastSeen: number;  // Unix epoch Date.now();
}

// if lastSeen < oneHourAgo {}

export async function sq77(db: Database) {
	let tracking: Tracker[] = [];
	while (running) {
		const now = Date.now();
		const nowFormated = formatDateEpoch(now);
		const oneHourAgo = Date.now() - 60 * 60 * 1000;

		const a77 = await fetchADSB();
		if (a77) {
			console.log(`${nowFormated}: current result:`)
			console.log(a77);
			a77.ac?.map((ac) => {
				ac.mlat?.map((lat) => {
					console.log(lat);
				})
			})
		}

		// check if both arrays are empty
		if ((!a77?.ac || a77.ac.length === 0) && tracking.length === 0) {
			console.log(`${formatDateEpoch(now)}: No aircraft found & no aircraft tracked.`);
		}

		// if nothing is in the ac[] but tracking[] has items, show items.
		// this is to make sure tracking is correctly being allocated.
		if (a77?.ac?.length === 0 && tracking.length > 0) {
			console.log("flight(s) still in tracking:");
			tracking.forEach((ac) => {
				console.log(`   sessionId:${ac.id} hex: ${ac.hex}, count: ${ac.count}, last seen: ${formatDateEpoch(ac.lastSeen)}`);
			})

		}

		// loop through every element in a77.ac to see if it is in tracking.
		if (a77?.ac) {
			a77.ac.forEach((flight) => {
				if (!flight.hex) {
					// TODO: write to console and figure out where to write this in the db
					console.log("Flight missing hexCode:\n");
					console.log(flight)
					return;
				}
				// check if flight.hex is in tracking.
				if (tracking.some(tracked => tracked.hex === flight.hex)) {
					// update count and lastSeen
					console.log("updating tracked: ", flight.hex);
					console.log(`    ${flight.hex}: callsign: ${flight.flight}: reg: ${flight.r?.trim()}: type: ${flight.t}`);
					console.log(`    ${flight.squawk}: ${flight.emergency}: category: ${flight.category}`);
					if (flight.nav_modes && flight.nav_modes.length > 0) {
						console.log(`    automation: ${flight.nav_modes.join(', ')}`);
					}
					//get index
					const index = tracking.findIndex(tracked => tracked.hex === flight.hex);
					if (index !== -1) {
						tracking[index].count += 1;
						tracking[index].lastSeen = now;
						console.log("updated flight in tracking:\n", tracking[index]);

						// update db
						const sesssion_id = tracking[index].id;
						const seqNr = tracking[index].count += 1;
						console.log("============debugging tracking=========")
						console.log(`sessson_id: ${sesssion_id}, seqNr: ${seqNr}`);

						dbQueue.add(() => dbSingleAircraftTracking(db, flight, sesssion_id, seqNr));
					}

				} else {
					// flight isn't being tracked and needs to be added to the tracking array.
					const trackingId = uuidv4();

					tracking.push({
						id: trackingId,
						hex: flight.hex,
						count: 1,
						lastSeen: now,
					})
					// send flight info to console
					console.log(`${nowFormated}: New tracking session: ${trackingId} started.`)
					console.log(`    ${flight.hex} is now being tracked.`);
					console.log(`    ${flight.hex}: callsign: ${flight.flight}: reg: ${flight.r?.trim()}: type: ${flight.t}`);
					console.log(`    ${flight.squawk}: ${flight.emergency}: category: ${flight.category}`);
					// add to db
					dbQueue.add(() => dbSingleAircraftTracking(db, flight, trackingId, 1));

					// run an other functions (like post to socials)
					const sqTxt: SquawkText = {
						registration: flight.r,
						equipment: flight.t,
						callsign: flight.flight,
						hex: flight.hex,
						lat: flight.lat ?? flight.rr_lat,
						lon: flight.lon ?? flight.rr_lon
					};

					const postTitle = titleBuilder(sqTxt);
					if (postTitle) {
						console.log(postTitle);
					}


				}

			})
		}


		// last remove elements from tracking once lastSeen > oneHourAgo.
		// tracking = tracking.filter(tracked => tracked.lastSeen > oneHourAgo);
		// Mutates the orgininal array in-place
		for (let i = tracking.length - 1; i >= 0; i--) {
			if (tracking[i].lastSeen <= oneHourAgo) {
				// TODO: final update on tracking.
				console.log(`${nowFormated}: removing session ${tracking[i].id}. hex: ${tracking[i].hex}`)
				tracking.splice(i, 1);
			}
		}

		if (tracking.length > 0) {
			console.log("In tracking:");
			console.log(JSON.stringify(tracking, null, 2));
		}

		console.log("epoch one hour ago: ", oneHourAgo);
		console.log("sq77() dev mode 10s when nothing in response.ac");

		console.log("-------------------------------------------------------------------------------\n\n");
		// if nothing is being tracked in ac, run once a minute. if aircraft are in ac, run every 6 secconds.
		const timeout = (a77?.ac?.length ?? 0) > 0 ? 6000 : 30000; // TODO: 10000:: change to 60000 in prod.
		await new Promise((resolve) => setTimeout(resolve, timeout));
	}
	console.log("stopped sq77()");
}

export async function stopSq77() {
	running = false;
}
