import { Database } from "sqlite";
import { Aircraft } from "../types";
import { getRedditMessageBySessionId } from "../db/dbCreateRedditPost";
import { extractPostId, RedditPoster } from "postreddit";
import { dbRedditPost } from "./simpleRedditPost";
import { findClosestAirports } from "closest-airport-static-utils";

export async function postRedditComment(db: Database, ac: Aircraft, sessionId: string, message: string) {
	try {
		const url = await getRedditMessageBySessionId(db, sessionId);
		if (url) {
			console.log("getRedditMessageBySessionId() in tracking:", url);

			const lat = ac.lat ?? ac.rr_lat;
			const lon = ac.lon ?? ac.rr_lon;

			let mapLink: string = "";

			if (lat && lon) {
				mapLink = `\n\n[Aprox. Location](https://www.openstreetmap.org/#map=13/${lat}/${lon})`
			}

			const grdMessage = `${ac.hex}:${ac.r}: ${ac.flight} is reporting touchdown. ${mapLink}`;
			const postId = extractPostId(url);

			if (postId) {
				await RedditPoster.commentOnPost(postId, grdMessage);
				// add db logging to socail_posts
				dbRedditPost(db, sessionId, postId, "reddit_comment", "posted", undefined, grdMessage, undefined);
			} else {
				console.log("getRedditMessageBySessionId() missing postId");
				dbRedditPost(db, sessionId, "error", "reddit_comment", "failed", undefined, grdMessage, "missing postId");

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

	let acInfo: string[] = [];

	acInfo.push(ac.flight?.trim() || ac.r?.trim() || ac.hex || 'Unknown Aircraft');
	acInfo.push(" is reporting touchdown")

	// TODO: make sure closet airport type is any::
	findClosestAirports()

	let mapLink: string = "";

	if (lat && lon) {
		mapLink = `\n\n[Aprox. Location](https://www.openstreetmap.org/#map=13/${lat}/${lon})`
	}

	const grdMessage = `${ac.hex}:${ac.r}: ${ac.flight} is reporting touchdown. ${mapLink}`;



}
