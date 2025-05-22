import { Database } from 'sqlite';
import { Aircraft } from '../types';
import { dbQueue } from "./queue/dbQueue";
import { RedditPoster } from 'postreddit';
import { createSocialPost } from '../social/createSocialPost';

/**
 * Creates social post database entry and posts to Reddit
 * @param db Database connection
 * @param flight Aircraft data
 * @param trackingId The tracking session ID
 * @param trackingCount Current tracking count
 * @param subreddit The subreddit to post to
 * @param postContent The content/body of the Reddit post
 * @returns Promise<void>
 */
export async function dbCreateRedditPost(
	db: Database,
	flight: Aircraft,
	trackingId: string,
	trackingCount: number,
	subreddit: string,
	postContent: string = ''
): Promise<void> {
	// Only proceed if we've tracked this aircraft enough times
	if (trackingCount < 3) return;

	// Generate post title from flight data
	const postTitle = await createSocialPost(flight);
	// const sqTxt: SquawkText = {
	// 	registration: flight.r,
	// 	equipment: flight.t,
	// 	callsign: flight.flight,
	// 	hex: flight.hex,
	// 	lat: flight.lat ?? flight.rr_lat,
	// 	lon: flight.lon ?? flight.rr_lon
	// };
	//
	// const postTitle = titleBuilder(sqTxt);
	if (!postTitle) return;

	console.log(`db: Preparing Reddit post with title: ${postTitle}`);

	try {
		// Find the tracking session ID
		const trackingSession = await dbQueue.get<{ id: number }>(
			db,
			'SELECT id FROM tracking_sessions WHERE session_id = ? ORDER BY seqNr DESC LIMIT 1',
			[trackingId],
			2
		);

		if (!trackingSession) {
			console.error(`No tracking session found for session ID: ${trackingId}`);
			return;
		}

		// Get Reddit platform ID (assuming it exists in your social_platforms table)
		const redditPlatform = await dbQueue.get<{ id: number }>(
			db,
			'SELECT id FROM social_platforms WHERE name = ?',
			['Reddit'],
			2
		);

		if (!redditPlatform) {
			console.error('Reddit platform not found in social_platforms table');
			return;
		}

		// Check if we've already created a post record for this tracking session and platform
		const existingPost = await dbQueue.get<{ id: number, status: string }>(
			db,
			'SELECT id, status FROM flight_posts WHERE tracking_session_id = ? AND platform_id = ?',
			[trackingSession.id, redditPlatform.id],
			2
		);

		let postRecordId: number;

		if (existingPost) {
			if (existingPost.status === 'posted') {
				console.log(`Reddit post already exists and was posted for tracking session: ${trackingSession.id}`);
				return;
			}
			postRecordId = existingPost.id;
		} else {
			// Create the database record first
			const result = await dbQueue.run(
				db,
				`INSERT INTO flight_posts 
         (tracking_session_id, platform_id, title, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
				[trackingSession.id, redditPlatform.id, postTitle, 'queued'],
				2
			);
			postRecordId = result.lastID;
		}

		// Now attempt to post to Reddit
		console.log(`Posting to Reddit: r/${subreddit}`);
		const redditUrl = await RedditPoster.postText(subreddit, postTitle, postContent);

		if (redditUrl) {
			// Update the database record with success
			await dbQueue.run(
				db,
				`UPDATE flight_posts 
         SET status = ?, external_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
				['posted', redditUrl, postRecordId],
				2
			);
			console.log(`✅ Reddit post successful: ${redditUrl}`);
		} else {
			// Update the database record with failure
			await dbQueue.run(
				db,
				`UPDATE flight_posts 
         SET status = ?, error_message = ?, updated_at = datetime('now')
         WHERE id = ?`,
				['failed', 'Reddit posting failed', postRecordId],
				2
			);
			console.log(`❌ Reddit post failed for session ${trackingId}`);
		}

	} catch (error) {
		console.error('Error in createRedditPost:', error);
	}
}
