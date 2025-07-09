import { RedditPoster } from "postreddit";
import { getDB } from "./db/db";
import { startServer, stopServer } from "./server";
import { sq77, stopSq77 } from "./sq77";
import { TelegramBotManager } from "./social/TelegramBot";

let startSq77 = false;
let startTelegram = false;

async function main() {
	const db = await getDB();

	// if schema check fails, stop running.
	if (!db) { return };

	startServer(db);

	if (RedditPoster.isConfigured()) {
		console.log("Reddit Posting Configured");
	} else {
		console.log("Reddit posting is not configured.")
	}

	if (TelegramBotManager.isConfigured()) {
		console.log("Telegram Bot Configured.")
		startTelegram = true;
		TelegramBotManager.init();
		TelegramBotManager.start();
	} else {
		console.log(`Telegram bot is not running.\nTo use Telegram bot, add appropriate TELEGRAM_BOT_TOKEN & TELEGRAM_CHANNEL_ID to your dotenv.`);
	}

	startSq77 = true;
	sq77(db).catch((err) => {
		console.error("sq77() error: ", err);
	});

	// Handle shutdown signals
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

async function shutdown() {
	console.log("\nshutting down the server...");

	if (startSq77) {
		await stopSq77();
		startSq77 = false;
	}

	if (startTelegram) {
		await TelegramBotManager.shutdown()
	}

	await stopServer();
	console.log("Shutdown complete.");
	process.exit(0);

}

main().catch(async (err) => {
	console.error("Fatal error in main(): ", err);
	await TelegramBotManager.shutdown();
	process.exit(1);
});
