import { RedditPoster } from "postreddit";
import { Aircraft } from "../types";
import { createSocialPost } from "./createSocialPost";
import { writeRandomTextFile } from "../etc/writeRandomTextFile";
import { dbQueue } from "../db/queue/dbQueue";
import { Database } from "sqlite";

export async function simpleRedditPost(flight: Aircraft): Promise<void> {
	const postTitle = await createSocialPost(flight);
	if (!postTitle) {
		console.log("redditPost(): missing postTitle")
		return;
	}

	const subreddit = "squawk7700";
	const postContent = "";

	try {
		console.log(`Posting to Reddit: r/${subreddit}`);
		const redditUrl = await RedditPoster.postText(subreddit, postTitle, postContent);

		if (redditUrl) {
			// write to db as posted with url
			writeRandomTextFile(redditUrl);
			const status = "posted";
		} else {
			// write to db as failed.
			const status = "failed";
			writeRandomTextFile("missing redditUrl");
		}

	} catch (error) {
		console.error("RedditPoster failed: ", error)
		writeRandomTextFile(`error in reddit poster: ${error}`);
	}
}


export async function redditPoster(
	db: Database,
	flight: Aircraft,
	sessionId: string
): Promise<void> {
	const postTitle = await createSocialPost(flight);
	if (!postTitle) {
		console.log("redditPost(): missing postTitle")
		return;
	}

	const subreddit = "squawk7700";
	const postContent = "";

	try {
		console.log(`Posting to Reddit: r/${subreddit}`);
		const redditUrl = await RedditPoster.postText(subreddit, postTitle, postContent);

		if (redditUrl) {
			// write to db as posted with url
			writeRandomTextFile(redditUrl);
			const status = "posted";
			await dbRedditPost(db, sessionId, subreddit, postTitle, status, redditUrl, postContent);
		} else {
			// write to db as failed.
			const status = "failed";
			const err = "Error: unable to post to reddit!"
			const external_id = ""
			writeRandomTextFile("missing redditUrl");

			await dbRedditPost(db, sessionId, subreddit, postTitle, status, external_id, postContent, err);
		}

	} catch (error) {
		console.error("RedditPoster failed: ", error)
		writeRandomTextFile(`error in reddit poster: ${error}`);
	}
}


// TODO: move to db/
async function dbRedditPost(
	db: Database,
	sessionId: string,
	subreddit: string,
	title: string,
	status: string,
	url?: string,
	message?: string,
	error_message?: string
) {
	// TODO: handle when RedditPoster fails: status "failed", error_message: error
	const platform = "Reddit";
	const readPriority = 2;
	// db
	// redditUrl
	// postTitle
	// message (postContent)
	// channel (subreddit)
	// sessionId
	try {
		const platform_id = await dbQueue.get<{ id: number }>(
			db,
			'SELECT id FROM social_platforms WHERE name=?',
			[platform],
			readPriority
		);

		if (platform_id) {
			// get tracking_session_id at start
			const tracking_session_id = await dbQueue.get<{ id: number }>(
				db,
				`SELECT id FROM tracking_sessions 
				WHERE session_id=?
				ORDER BY seqNr ASC LIMIT 1;
				`,
				[sessionId],
				readPriority
			);

			if (tracking_session_id) {
				// add to social_posts
				await dbQueue.run(
					db,
					`INSERT INTO social_posts (tracking_session_id, platform_id, 
					channel, title, message, external_id, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[tracking_session_id, platform_id, subreddit, title, message, url, status, error_message]
				);

			}
		}
	} catch (error) {
		console.error("dbPostReddit(): ", error);
		// debug
		writeRandomTextFile(`dbPostReddit(${sessionId}): ${error}`);
	}

}
