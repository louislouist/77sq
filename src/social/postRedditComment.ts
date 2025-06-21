import { Database } from "sqlite";
import { Aircraft } from "../types";
import { getRedditMessageBySessionId } from "../db/dbCreateRedditPost";
import { extractPostId, RedditPoster } from "postreddit";
import { dbRedditPost } from "./simpleRedditPost";
import { findClosestAirports, haversineDistance, loadAirports } from "closest-airport-static-utils";

export async function postRedditComment(db: Database, sessionId: string, message: string) {
	try {
		const url = await getRedditMessageBySessionId(db, sessionId);
		if (url) {
			console.log("getRedditMessageBySessionId() in tracking:", url);

			const postId = extractPostId(url);

			if (postId) {
				await RedditPoster.commentOnPost(postId, message);
				// add db logging to socail_posts
				dbRedditPost(db, sessionId, postId, "reddit_comment", "posted", undefined, message, undefined);
			} else {
				console.log("getRedditMessageBySessionId() missing postId");
				dbRedditPost(db, sessionId, "error", "reddit_comment", "failed", undefined, message, "missing postId");

			}
		} else {
			console.log('No reddit url found for sessionId:', sessionId);
			dbRedditPost(db, sessionId, "error", "reddit_comment", "failed", undefined, message, "No reddit url found for sessionId.")
		}
	} catch (err) {
		const error = (err as Error).message;
		console.error('Error during Reddit post comment:', err);
		dbRedditPost(db, sessionId, "error", "reddit_comment", "failed", undefined, message, error);
	}
}

export function redditLandedMessage(ac: Aircraft): string {
	const lat = ac.lat ?? ac.rr_lat;
	const lon = ac.lon ?? ac.rr_lon;

	let landedMsg: string[] = [];

	landedMsg.push(ac.flight?.trim() || ac.r?.trim() || ac.hex || 'Unknown Aircraft');
	landedMsg.push("is reporting touchdown.");

	let mapLink: string = "";

	if (lat && lon) {
		mapLink = `\n\n[ADS-B Map Location](https://www.openstreetmap.org/#map=13/${lat}/${lon})`

		let msgAirport: string[] = [];

		const airports = loadAirports();
		const closeAirport = findClosestAirports(lat, lon, airports, 1, []);

		const airportName = closeAirport[0].name;
		msgAirport.push(`\n\n${airportName}`);

		const airportIcao = closeAirport[0].icao;
		const airportIata = closeAirport[0].iata;

		if (airportIcao && airportIata) {
			msgAirport.push(`: (${airportIcao})/(${airportIata})`);
		} else if (airportIcao || airportIata) {
			msgAirport.push(`: (${airportIata || airportIcao})`);
		}

		const distance = distanceFromAirport(lat, lon, closeAirport[0].lat, closeAirport[0].lon);

		// TODO: after formatting, select distance to show.
		if (distance.km > 1) {
			console.log("distance > 1km: ", distance.km);
		}

		landedMsg.push(`\n\n${distance.miles.toFixed(1)}miles/${distance.km.toFixed(1)}km from airport.`);


		landedMsg.push(msgAirport.join(''));
		landedMsg.push(mapLink);
	}

	return landedMsg.join(" ");
}


export function redditApproachMessage(ac: Aircraft): string {
	const lat = ac.lat ?? ac.rr_lat;
	const lon = ac.lon ?? ac.rr_lon;

	let approachMsg: string[] = [];

	approachMsg.push(ac.flight?.trim() || ac.r?.trim() || ac.hex || 'Unknown Aircraft');
	approachMsg.push("autopilot approach set.");

	let mapLink: string = "";

	if (lat && lon) {
		mapLink = `\n\n[ADS-B Map Location](https://www.openstreetmap.org/#map=13/${lat}/${lon})`

		const airports = loadAirports();
		const closeAirport = findClosestAirports(lat, lon, airports, 1);
		const airportName = closeAirport[0].name;
		const airportIcao = closeAirport[0].icao;
		const airportIata = closeAirport[0].iata;

		approachMsg.push(`\n\nnear: ${airportName}: (${airportIcao}):(${airportIata})`);
		approachMsg.push(mapLink);
	}

	return approachMsg.join(" ");
}

type AirportDistance = {
	km: number;
	miles: number;
}

function distanceFromAirport(ac_lat: number, ac_lon: number, ap_lat: number, ap_lon: number): AirportDistance {
	const km = haversineDistance(ac_lat, ac_lon, ap_lat, ap_lon);
	return { km, miles: kmToMiles(km) }

}

function kmToMiles(km: number): number {
	const milesPerKm = 0.621371;
	return km * milesPerKm;
}
