import { RedditPoster } from "postreddit";
import { Aircraft } from "../types";
import { createSocialPost } from "./createSocialPost";
import { writeRandomTextFile } from "../etc/writeRandomTextFile";

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
			writeRandomTextFile(redditUrl);
		} else {
			writeRandomTextFile("missing redditUrl");
		}

	} catch (error) {
		console.error("RedditPoster failed: ", error)
		writeRandomTextFile(`error in reddit poster: ${error}`);
	}
}
