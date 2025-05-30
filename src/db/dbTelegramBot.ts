import { Database } from "sqlite";
import { writeRandomTextFile } from "../etc/writeRandomTextFile";
import { dbQueue } from "./queue/dbQueue";
import { TelegramBotManager } from "../social/TelegramBot";

export async function dbTelegramBot(
	db: Database,
	sessionId: string,
	title: string,		// post info
	status: string,
	url?: string,
	message?: string,	// post content
	error_message?: string
): Promise<void> {
	// TODO: handle when TelegramBotManager fails: status "failed", error_message: error
	const platform = "Telegram";
	const readPriority = 2;

	const channelId = TelegramBotManager.getSettings().channelId;

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
					[tracking_sessions_id.id, platform_id.id, sessionId, channelId, title, message, url, status, error_message]
				);

			}
		}
	} catch (error) {
		console.error("db(): ", error);
		// debug
		writeRandomTextFile(`dbTelegramBot(): ${sessionId}): ${error}`);
	}

}


