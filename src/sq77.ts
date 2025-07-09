import { fetchADSB } from "./fetchADSB";
import { formatDateEpoch, getTimestamp, timeLastSeen } from "./etc/Dates";
import { v4 as uuidv4 } from 'uuid';
import { dbSingleAircraftTracking } from "./db/dbSingleAircraftTracking";
import { Database } from "sqlite";
import { dbQueue } from "./db/queue/dbQueue";
import { titleBuilderTelegram } from "./social/titleBuilder";
import { ADSBResponse, Aircraft, Session, ADSBLookup } from "./types";
import { RedditPoster } from "postreddit";
import { redditPoster } from "./social/simpleRedditPost";
import { TelegramBotManager } from "./social/TelegramBot";
import { dbTelegramBot } from "./db/dbTelegramBot";
import { postRedditComment, redditApproachMessage, redditLandedMessage } from "./social/postRedditComment";
import { getTrackable } from "./db/getTrackable";
import { getRandomNumber, lineBreak, shortSessionId } from "./etc/Handlers";
import { closestAirportInfo, infoAircraft } from "./etc/Text";

let running = true;

interface Tracker {
	id: string;
	hex: string;
	count: number;
	ground: boolean;
	approach: boolean;
	lastSeen: number;  // Unix epoch Date.now();
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ACTIVE_POLL_INTERVAL = 6000;   // When aircraft are being tracked
const IDLE_POLL_INTERVAL = 30000;    // When no aircraft are being tracked

/**
 * Logs current aircraft data for debugging
 */
function logCurrentAircraftData(adsb: ADSBResponse | null, timestamp: string): void {
	if (adsb) {
		console.log(`${timestamp}: current result:`);
		console.log(adsb);
		adsb.ac?.forEach(ac => {
			ac.mlat?.forEach(lat => {
				console.log(lat);
			});
		});
	}
}

/**
 * Handles the case when no aircraft are found and none are being tracked
 */
function logNoActivityState(timestamp: string): void {
	console.log(`${timestamp}: No aircraft found & no aircraft tracked.`);
}

/**
 * Logs currently tracked flights when no new aircraft are detected
 */
function logTrackedFlights(tracking: Tracker[]): void {
	if (tracking.length > 0) {
		console.log("flight(s) still in tracking:");
		tracking.forEach(ac => {
			console.log(`   sessionId:${ac.id} hex: ${ac.hex}, count: ${ac.count}, ground: ${ac.ground}, approach: ${ac.approach}, last seen: ${formatDateEpoch(ac.lastSeen)}`);
		});
	}
}

/**
 * Validates if aircraft has required hex code
 */
function validateAircraft(flight: Aircraft): boolean {
	if (!flight.hex) {
		console.log("Flight missing hexCode:\n", flight);
		return false;
	}
	return true;
}

/**
 * Logs aircraft information to console
 */
function logAircraftInfo(flight: Aircraft): void {
	console.log(`    ${flight.hex}: callsign: ${flight.flight}: reg: ${flight.r?.trim()}: type: ${flight.t}`);
	console.log(`    ${flight.squawk}: ${flight.emergency}: category: ${flight.category}`);
	if (flight.nav_modes && flight.nav_modes.length > 0) {
		console.log(`    automation: ${flight.nav_modes.join(', ')}`);
	}
}

/**
 * Updates existing tracked aircraft
 */
async function updateTrackedAircraft(
	db: Database,
	flight: Aircraft,
	tracking: Tracker[],
	now: number
): Promise<void> {
	const hex = flight.hex?.toUpperCase();
	if (!hex) {
		console.error("updatedTrackedAircraft(): missing hexCode!");
		return;
	}

	console.log("updating tracked: ", hex);

	logAircraftInfo(flight);
	const index = tracking.findIndex(tracked => tracked.hex === hex);
	if (index !== -1) {
		tracking[index].count += 1;
		tracking[index].lastSeen = now;
		console.log("updated flight in tracking:\n", tracking[index]);

		// Update database
		const sessionId = tracking[index].id;
		const seqNr = tracking[index].count;
		console.log("============debugging tracking=========");
		console.log(`session_id: ${sessionId}, seqNr: ${seqNr}`);

		// Add tracking session update to queue
		dbQueue.add(() => dbSingleAircraftTracking(db, flight, sessionId, seqNr));

		// resets if flight lifts off again or there is a data error with "ground".
		if (typeof flight.alt_baro === 'number') {
			if (tracking[index].ground === true && flight.alt_baro > 1000) {
				tracking[index].ground = false;
			}
		}

		// If we've tracked this aircraft exactly 3 times, create Reddit post
		if (tracking[index].count === 3) {
			if (RedditPoster.isConfigured()) {
				//debug
				console.log("RedditPoster configured()");
				//endDebug
				await redditPoster(db, flight, sessionId);
			}
		}

		// ground or approach update tracking and socials
		if (tracking[index].count > 3) {
			// update ground
			if (flight.alt_baro === "ground" && tracking[index].ground != true) {
				// write to social and update
				const grdMessage = `${flight.hex}:${flight.r}: ${flight.flight} is reporting touchdown.`;
				tracking[index].ground = true;
				if (TelegramBotManager.isConfigured()) {
					await TelegramBotManager.sendToDefaultChannel(grdMessage);
					await dbTelegramBot(
						db,
						sessionId,
						"info_post",
						"posted",
						undefined,
						grdMessage,
						undefined
					)
				}
				// comment on reddit post.
				// get from social_posts: session_id, title = reddit_url, { message }
				if (RedditPoster.isConfigured()) {
					const msg = redditLandedMessage(flight);
					await postRedditComment(db, sessionId, msg);
				}
			}
			// update approach
			if (flight.nav_modes?.includes("approach") && tracking[index].approach != true) {
				// ‘althold’, ‘approch')?
				tracking[index].approach = true;
				const approachMessage = `${flight.hex}: ${flight.r}: ${flight.flight} autopilot is in approach.`;
				if (TelegramBotManager.isConfigured()) {
					await TelegramBotManager.sendToDefaultChannel(approachMessage);
					await dbTelegramBot(
						db,
						tracking[index].id,
						"info_post",
						"posted",
						undefined,
						approachMessage,
						undefined
					)
				}
				if (RedditPoster.isConfigured()) {
					const msg = redditApproachMessage(flight);
					await postRedditComment(db, sessionId, msg);
				}
			} // maybe set tracking approach to false as an else covering approach on then off than on again.
		}
	}
}

/**
 * Adds new aircraft to tracking
 */
async function addNewTrackedAircraft(
	db: Database,
	ac: Aircraft,
	tracking: Tracker[],
	now: number,
	timestamp: string
): Promise<void> {
	const trackingId = uuidv4();

	const hex = ac.hex?.toUpperCase();
	if (!hex || tracking.some(t => t.hex === hex)) {
		console.error("addNewTrackedAircraft(): missing hex!");
		return;
	}

	tracking.push({
		id: trackingId,
		hex: hex,
		count: 1,
		ground: false,
		approach: false,
		lastSeen: now,
	});

	// Log new tracking session
	console.log(`${timestamp}: New tracking session: ${trackingId} started.`);
	console.log(`    ${ac.hex} is now being tracked.`);
	logAircraftInfo(ac);

	// Add to database
	dbQueue.add(() => dbSingleAircraftTracking(db, ac, trackingId, 1));

	// Create social media post
	if (TelegramBotManager.isConfigured() && ac.squawk === "7700") {
		const title = titleBuilderTelegram(ac);
		if (title) {
			await TelegramBotManager.sendToDefaultChannel(title);
			await dbTelegramBot(
				db,
				trackingId,
				"info_post",
				"posted",
				undefined,
				title,
				undefined
			)
		} else {
			await TelegramBotManager.sendToDefaultChannel(`Missing Title: icao hex: ${ac.hex}`);
		}
	}
}

/**
 * Processes all current aircraft and updates tracking accordingly
 */
async function processCurrentAircraft(
	db: Database,
	adsb: ADSBResponse | null,
	tracking: Tracker[],
	now: number,
	timestamp: string
): Promise<void> {
	if (!adsb?.ac) { return; }

	const seen = new Set<string>();


	for (const flight of adsb.ac) {
		// Validate aircraft
		if (!validateAircraft(flight)) continue;

		const hex = flight.hex?.toUpperCase();
		if (!hex || seen.has(hex)) continue;
		seen.add(hex);

		flight.hex = hex;

		// Check if aircraft is already being tracked
		const isTracked = tracking.some(tracked => tracked.hex === hex);

		if (isTracked) {
			await updateTrackedAircraft(db, flight, tracking, now);
		} else {
			await addNewTrackedAircraft(db, flight, tracking, now, timestamp);
		}
	}
}

/**
 * Removes aircraft that haven't been seen for over an hour
 */
function cleanupExpiredTracking(tracking: Tracker[], oneHourAgo: number, timestamp: string): void {
	for (let i = tracking.length - 1; i >= 0; i--) {
		let hex = tracking[i].hex.toUpperCase();
		let sessionId = tracking[i].id;

		if (tracking[i].lastSeen <= oneHourAgo) {
			console.log(`${timestamp}: removing session ${sessionId}. hex: ${hex}`);
			tracking.splice(i, 1);
		}
	}
}

/**
 * Logs current tracking status
 */
function logTrackingStatus(tracking: Tracker[], oneHourAgo: number): void {
	if (tracking.length > 0) {
		console.log("In tracking:");
		console.log(JSON.stringify(tracking, null, 2));
	}

	console.log("epoch one hour ago: ", oneHourAgo);
	console.log("sq77() dev mode 10s when nothing in response.ac");
	console.log("-------------------------------------------------------------------------------\n\n");
}

/**
 * Determines the appropriate polling interval based on activity
 */
function getPollingInterval(aircraftCount: number): number {
	return aircraftCount > 0 ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL;
}


function logAircraft(message: string) {
	const dateTime = getTimestamp();

	console.log(`${dateTime}: ${message}`);
}

async function logReturnedAircraft(acList: Aircraft[]) {
	for (const ac of acList) {
		const acInfo = await infoAircraft(ac);

		logAircraft(acInfo);
	}
}


/**
 * Main aircraft tracking loop
 */
// export async function sq77(db: Database): Promise<void> {
// 	let tracking: Tracker[] = [];
//
// 	while (running) {
// 		const now = Date.now();
// 		const timestamp = formatDateEpoch(now);
// 		const oneHourAgo = now - ONE_HOUR_MS;
//
// 		// Fetch current aircraft data
// 		const adsb = await fetchADSB();
//
// 		// Log current data for debugging
// 		logCurrentAircraftData(adsb, timestamp);
//
// 		// Handle different states
// 		const hasCurrentAircraft = adsb?.ac && adsb.ac.length > 0;
// 		const hasTrackedAircraft = tracking.length > 0;
//
// 		if (!hasCurrentAircraft && !hasTrackedAircraft) {
// 			logNoActivityState(timestamp);
// 		} else if (!hasCurrentAircraft && hasTrackedAircraft) {
// 			// TODO: add better tracking log.
// 			logTrackedFlights(tracking);
// 		}
//
// 		// Process current aircraft
// 		// TODO: update function for [Aircraft]
// 		await processCurrentAircraft(db, adsb, tracking, now, timestamp);
//
// 		// Clean up expired tracking sessions
// 		cleanupExpiredTracking(tracking, oneHourAgo, timestamp);
//
// 		// Log current status
// 		logTrackingStatus(tracking, oneHourAgo);
//
// 		// Wait before next iteration
// 		const timeout = getPollingInterval(adsb?.ac?.length ?? 0);
// 		await new Promise(resolve => setTimeout(resolve, timeout));
// 	}
//
// 	console.log("stopped sq77()");
// }

export async function sq77too(db: Database): Promise<void> {
	let sessions: Session[] = [];

	while (running) {
		const trackable: ADSBLookup[] = await getTrackable(db);

		// TODO: currentAC
		let ac: Aircraft[] = [];

		const retryDelay = getRandomNumber(500, 3500);
		// if mode debug print all aircraft.

		const results = await Promise.all(
			trackable.map(adsb => fetchADSB(adsb.type, adsb.value, 2, retryDelay))
		);

		for (const res of results) {
			if (res?.ac) {
				ac = ac.concat(res.ac);
			}
		}

		const hasCurrentAircraft = ac && ac.length > 0;
		const hasTrackedAircraft = sessions.length > 0;
		const now = Date.now();
		const oneHourAgo = now - ONE_HOUR_MS;

		await processAircraftAndSessions(db, ac, sessions, now);

		cleanupExpiredSessions(sessions, oneHourAgo)

		if (!hasCurrentAircraft && !hasTrackedAircraft) {
			logAircraft("No aircraft tracked & no current sessions tracked.")
		} else {
			// write currentAC and sessions to console.
			if (ac.length > 3 || sessions.length > 2) {
				lineBreak(80, getTimestamp());
			}
			// display current sessions
			const formatedSessions = sessions.map(session => ({
				...session,
				id: shortSessionId(session.id),
				lastSeen: timeLastSeen(session.lastSeen),
			}));

			console.table(formatedSessions);
			// show current tracked ac
			if (ac.length === 0) {
				const currentEndpoints = trackable.map(endpoint => `${endpoint.type}: ${endpoint.value}`);
				logAircraft(`Currenly no aircraft seen in ${currentEndpoints.join(", ")}`);
			}

			if (ac.length > 3) {
				lineBreak(80, getTimestamp());
			}

			logReturnedAircraft(ac)
		}


		// Wait before next iteration
		const timeout = getPollingInterval(ac.length ?? 0);
		await new Promise(resolve => setTimeout(resolve, timeout));

	}
}

/**
 * Stops the tracking loop
 */
export async function stopSq77(): Promise<void> {
	running = false;
}

async function processAircraftAndSessions(
	db: Database,
	returnedAC: Aircraft[],
	sessions: Session[],
	now: number
) {
	// check to see if in current sessions.
	for (const ac of returnedAC) {
		if (!ac.hex) {
			// TODO: database log to errors but it should never happen
			return;
		}
		const hex = ac.hex.toUpperCase();

		const hexInSessions = sessions.some(session => session.hex === hex);

		if (hexInSessions) {
			// update AC
			await updateAircraftInSessions(db, ac, sessions, now);
		} else {
			// add AC
			await addNewAircraftToSessions(db, ac, sessions, now);
		}
	}

}


async function addNewAircraftToSessions(db: Database, ac: Aircraft, sessions: Session[], now: number) {
	if (!ac.hex) {
		return;
	}

	const hex = ac.hex.toUpperCase()

	// check if ac.hex is already in sessions.
	const hexExists = sessions.some(session => session.hex === hex)
	if (hexExists) {
		return;
	}

	const sessionId = uuidv4();
	const squawk = ac.squawk ?? "-55";

	const acSession: Session = {
		id: sessionId,
		hex: hex,
		endpoint: ac.endpoint ?? 'MISSING',
		squawk: squawk,
		acType: ac.t,
		count: 1,
		ground: false,
		approach: false,
		lastSeen: now
	}

	sessions.push(acSession);

	// write to db
	dbQueue.add(() => dbSingleAircraftTracking(db, ac, sessionId, 1));

	// Create social media post
	if (TelegramBotManager.isConfigured() && ac.squawk === "7700") {
		// const title = titleBuilderTelegram(ac);
		const title = await infoAircraft(ac)
		if (title) {
			await TelegramBotManager.sendToDefaultChannel(title);
			await dbTelegramBot(
				db,
				sessionId,
				"info_post",
				"posted",
				undefined,
				title,
				undefined
			)
		} else {
			await TelegramBotManager.sendToDefaultChannel(`Missing Title: icao hex: ${ac.hex}`);
		}
	}

}

async function updateAircraftInSessions(
	db: Database,
	ac: Aircraft,
	sessions: Session[],
	now: number
): Promise<void> {
	const hex = ac.hex?.toUpperCase();
	if (!hex) {
		console.error("updatedAircraftInSessions(): missing hexCode!");
		// TODO: db error log
		return;
	}


	// DEBUG ONLY logAircraftInfo(ac);
	//

	const index = sessions.findIndex(tracked => tracked.hex === hex);
	if (index !== -1) {
		// update session for current ac.
		sessions[index].acType = ac.type;
		sessions[index].endpoint = ac.endpoint ?? 'MISSING';
		sessions[index].squawk = ac.squawk ?? '-55';
		sessions[index].count += 1;
		sessions[index].lastSeen = now;

		// Update database
		const sessionId = sessions[index].id;
		const seqNr = sessions[index].count;

		// Add tracking session update to queue
		dbQueue.add(() => dbSingleAircraftTracking(db, ac, sessionId, seqNr));

		// resets if flight lifts off again or there is a data error with "ground".
		if (typeof ac.alt_baro === 'number') {
			if (sessions[index].ground === true && ac.alt_baro > 1000) {
				sessions[index].ground = false;
			}
		}

		// If we've tracked this aircraft exactly 3 times, create Reddit post
		if (sessions[index].count === 3 && ac.squawk === '7700') {
			if (RedditPoster.isConfigured()) {
				//debug
				console.log("RedditPoster configured()");
				//endDebug
				await redditPoster(db, ac, sessionId);
			}
		}

		// ground or approach update tracking and socials
		if (sessions[index].count > 3 && ac.squawk === '7700') {
			// update ground
			if (ac.alt_baro === "ground" && sessions[index].ground != true) {
				// write to social and update
				const grdMessage = `${ac.hex}:${ac.r}: ${ac.flight} is reporting touchdown.`;
				sessions[index].ground = true;
				if (TelegramBotManager.isConfigured()) {
					await TelegramBotManager.sendToDefaultChannel(grdMessage);
					await dbTelegramBot(
						db,
						sessionId,
						"info_post",
						"posted",
						undefined,
						grdMessage,
						undefined
					)
				}
				// comment on reddit post.
				// get from social_posts: session_id, title = reddit_url, { message }
				if (RedditPoster.isConfigured()) {
					const msg = redditLandedMessage(ac);
					await postRedditComment(db, sessionId, msg);
				}
			}
			// update approach
			if (ac.squawk === '7700' && ac.nav_modes?.includes("approach") && sessions[index].approach != true) {
				// ‘althold’, ‘approch')?
				sessions[index].approach = true;
				const approachMessage = `${ac.hex}: ${ac.r}: ${ac.flight} autopilot is in approach.`;
				if (TelegramBotManager.isConfigured()) {
					await TelegramBotManager.sendToDefaultChannel(approachMessage);
					await dbTelegramBot(
						db,
						sessions[index].id,
						"info_post",
						"posted",
						undefined,
						approachMessage,
						undefined
					)
				}
				if (RedditPoster.isConfigured()) {
					const msg = redditApproachMessage(ac);
					await postRedditComment(db, sessionId, msg);
				}
			} // maybe set tracking approach to false as an else covering approach on then off than on again.
		}
		// handle ground outside of sending social.
		if (sessions[index].count > 4 && ac.alt_baro === "ground") {
			sessions[index].ground = true;
		}

		// and also approach
		if (sessions[index].count > 4 && ac.nav_modes?.includes("approach")) {
			sessions[index].approach = true;
		}
	}
}


function cleanupExpiredSessions(sessions: Session[], oneHourAgo: number): void {
	for (let i = sessions.length - 1; i >= 0; i--) {
		if (sessions[i].lastSeen <= oneHourAgo) {
			sessions.splice(i, 1);
		}
	}
}
