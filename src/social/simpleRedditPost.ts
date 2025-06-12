import { RedditPoster } from "postreddit";
import { Aircraft } from "../types";
import { createSocialPost } from "./createSocialPost";
import { writeRandomTextFile } from "../etc/writeRandomTextFile";
import { dbQueue } from "../db/queue/dbQueue";
import { Database } from "sqlite";
import { buildAircraftInfoText, buildAircraftInfoTextRMD } from "./infoBuilder";
import { TelegramBotManager } from "./TelegramBot";
import { dbTelegramBot } from "../db/dbTelegramBot";

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
	sessionId: string,
	subreddit?: string
): Promise<void> {
	const postTitle = await createSocialPost(flight);
	if (!postTitle) {
		console.log("redditPost(): missing postTitle");
		return;
	}

	const postContent = buildAircraftInfoTextRMD(flight);
	let redditUrl: string | null = null;
	let selectedSubreddit: string;

	try {
		if (subreddit) {
			selectedSubreddit = subreddit;
			console.log(`Posting to Reddit: r/${selectedSubreddit}`);
			redditUrl = await RedditPoster.postText(selectedSubreddit, postTitle, postContent);
		} else if (process.env.DEFAULT_SUBREDDIT) {
			selectedSubreddit = process.env.DEFAULT_SUBREDDIT;
			console.log(`Posting to default subreddit: r/${selectedSubreddit}`);
			redditUrl = await RedditPoster.defaultPostText(postTitle, postContent);
		} else {
			const errorMsg = "❌ No subreddit specified and DEFAULT_SUBREDDIT is not set in .env.";
			console.error(errorMsg);
			await TelegramBotManager.sendToDefaultChannel(`${sessionId}: ${errorMsg}`);
			writeRandomTextFile("Missing DEFAULT_SUBREDDIT and no subreddit provided.");
			return;
		}

		if (redditUrl) {
			const status = "posted";
			await dbRedditPost(db, sessionId, selectedSubreddit, postTitle, status, redditUrl, postContent);
			await TelegramBotManager.sendToDefaultChannel(redditUrl);
			await dbTelegramBot(
				db,
				sessionId,
				"reddit_url",
				"posted",
				undefined,
				redditUrl,
				undefined
			);
		} else {
			const status = "failed";
			const err = "Error: unable to post to reddit!";
			const external_id = "";
			writeRandomTextFile("missing redditUrl");
			await dbRedditPost(db, sessionId, selectedSubreddit, postTitle, status, external_id, postContent, err);
			await TelegramBotManager.sendToDefaultChannel(`${sessionId}: ${err}`);
		}
	} catch (error) {
		console.error("RedditPoster failed: ", error);
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

	try {
		const platform_id = await dbQueue.get<{ id: number }>(
			db,
			'SELECT id FROM social_platforms WHERE name=?',
			[platform],
			readPriority
		);

		if (platform_id) {
			// get tracking_session_id at start
			const tracking_sessions_id = await dbQueue.get<{ id: number }>(
				db,
				`SELECT id FROM tracking_sessions 
				WHERE session_id=?
				ORDER BY seqNr DESC LIMIT 1;
				`,
				[sessionId],
				readPriority
			);

			if (tracking_sessions_id) {
				// add to social_posts
				await dbQueue.run(
					db,
					`INSERT INTO social_posts (tracking_sessions_id, platform_id, session_id, 
					channel, title, message, external_id, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[tracking_sessions_id.id, platform_id.id, sessionId, subreddit, title, message, url, status, error_message]
				);

			}
		}
	} catch (error) {
		console.error("dbPostReddit(): ", error);
		// debug
		writeRandomTextFile(`dbPostReddit(${sessionId}): ${error}`);
	}

}


