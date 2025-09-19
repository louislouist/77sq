import { fetchADSB } from "./fetchADSB";
import { getTimestamp, timeLastSeen } from "./etc/Dates";
import { v4 as uuidv4 } from 'uuid';
import { dbSingleAircraftTracking } from "./db/dbSingleAircraftTracking";
import { Database } from "sqlite";
import { dbQueue } from "./db/queue/dbQueue";
import { Aircraft, Session, ADSBLookup } from "./types";
import { RedditPoster } from "postreddit";
import { redditPoster } from "./social/simpleRedditPost";
import { TelegramBotManager } from "./social/TelegramBot";
import { dbTelegramBot } from "./db/dbTelegramBot";
import { postRedditComment, redditApproachMessage, redditLandedMessage } from "./social/postRedditComment";
import { getTrackable } from "./db/getTrackable";
import { getRandomNumber, lineBreak, shortSessionId } from "./etc/Handlers";
import { infoAircraft } from "./etc/Text";
import { setSessions } from "./web/sessionStore";

let running = true;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ACTIVE_POLL_INTERVAL = 6000;   // When aircraft are being tracked
const IDLE_POLL_INTERVAL = 30000;    // When no aircraft are being tracked

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


export async function sq77(db: Database): Promise<void> {
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

		// web aircraft session
		setSessions(sessions);

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
		sessions[index].acType = ac.t;
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
		// reset "ground" if above 3000ft
		if (sessions[index].count > 4 && typeof ac.alt_baro === 'number' && ac.alt_baro > 3000) {
			sessions[index].ground = false;
		}


		// and also approach
		if (sessions[index].count > 4 && ac.nav_modes?.includes("approach")) {
			sessions[index].approach = true;
		}

		// reset approach when reset
		if (sessions[index].count > 4 && !ac.nav_modes?.includes("approach")) {
			sessions[index].approach = false;
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
