import { fetchADSB } from "./fetchADSB";
import { formatDateEpoch } from "./etc/Dates";
import { v4 as uuidv4 } from 'uuid';
import { dbSingleAircraftTracking } from "./db/dbSingleAircraftTracking";
import { Database } from "sqlite";
import { dbQueue } from "./db/queue/dbQueue";
import { SquawkText, titleBuilder, titleBuilderTelegram } from "./social/titleBuilder";
import { ADSBResponse, Aircraft } from "./types";
import { dbCreateRedditPost } from "./db/dbCreateRedditPost";
import { RedditPoster } from "postreddit";
import { writeRandomTextFile } from "./etc/writeRandomTextFile";
import { redditPoster, simpleRedditPost } from "./social/simpleRedditPost";
import { TelegramBotManager } from "./social/TelegramBot";
import { dbTelegramBot } from "./db/dbTelegramBot";

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

		// If we've tracked this aircraft exactly 3 times, create Reddit post
		if (tracking[index].count === 3) {
			if (RedditPoster.isConfigured()) {
				//debug
				console.log("RedditPoster configured()");
				//endDebug
				// const subreddit = 'squawk7700'; // Set your target subreddit
				// const postContent = `Flight details for ${flight.flight || flight.r || flight.hex}`;
				// dbQueue.add(() => dbCreateRedditPost(db, flight, sessionId, tracking[index].count, subreddit, postContent));
				await redditPoster(db, flight, sessionId);
				// await simpleRedditPost(flight);
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
						tracking[index].id,
						"info_post",
						"posted",
						undefined,
						grdMessage,
						undefined
					)
				}
				// comment on reddit post.
				// get from social_posts: session_id, title = reddit_url, { message }

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

			} // maybe set tracking approach to false as an else covering approach on then off than on again.
		}
	}
}

/**
 * Adds new aircraft to tracking
 */
async function addNewTrackedAircraft(
	db: Database,
	flight: Aircraft,
	tracking: Tracker[],
	now: number,
	timestamp: string
): Promise<void> {
	const trackingId = uuidv4();

	const hex = flight.hex?.toUpperCase();
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
	console.log(`    ${flight.hex} is now being tracked.`);
	logAircraftInfo(flight);

	// Add to database
	dbQueue.add(() => dbSingleAircraftTracking(db, flight, trackingId, 1));

	// Create social media post
	if (TelegramBotManager.isConfigured()) {
		const title = titleBuilderTelegram(flight);
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
			await TelegramBotManager.sendToDefaultChannel(`Missing Title: icao hex: ${flight.hex}`);
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

/**
 * Main aircraft tracking loop
 */
export async function sq77(db: Database): Promise<void> {
	let tracking: Tracker[] = [];

	while (running) {
		const now = Date.now();
		const timestamp = formatDateEpoch(now);
		const oneHourAgo = now - ONE_HOUR_MS;

		// Fetch current aircraft data
		const adsb = await fetchADSB();

		// Log current data for debugging
		logCurrentAircraftData(adsb, timestamp);

		// Handle different states
		const hasCurrentAircraft = adsb?.ac && adsb.ac.length > 0;
		const hasTrackedAircraft = tracking.length > 0;

		if (!hasCurrentAircraft && !hasTrackedAircraft) {
			logNoActivityState(timestamp);
		} else if (!hasCurrentAircraft && hasTrackedAircraft) {
			logTrackedFlights(tracking);
		}

		// Process current aircraft
		await processCurrentAircraft(db, adsb, tracking, now, timestamp);

		// Clean up expired tracking sessions
		cleanupExpiredTracking(tracking, oneHourAgo, timestamp);

		// Log current status
		logTrackingStatus(tracking, oneHourAgo);

		// Wait before next iteration
		const timeout = getPollingInterval(adsb?.ac?.length ?? 0);
		await new Promise(resolve => setTimeout(resolve, timeout));
	}

	console.log("stopped sq77()");
}

/**
 * Stops the tracking loop
 */
export async function stopSq77(): Promise<void> {
	running = false;
}
