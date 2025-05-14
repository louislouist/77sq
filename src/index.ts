import { getDB } from "./db/db";
import { startServer, stopServer } from "./server";
import { sq77, stopSq77 } from "./sq77";

let startSq77 = false;

async function main() {
	const db = await getDB();

	// if schema check fails, stop running.
	if (!db) { return };

	startServer();

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

	await stopServer();
	console.log("Shutdown complete.");
	process.exit(0);

}

main().catch((err) => {
	console.error("Fatal error in main(): ", err);
	process.exit(1);
});
