import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import { readFile } from "fs/promises";
import { access, constants } from "fs/promises";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve("adsb.sqlite");

// __dirname resolves to dist/ in production builds
// NOTE:     "build": "tsc && cp src/db/schema.sql dist/db/schema.sql",
const SCHEMA_PATH = path.resolve(__dirname, "schema.sql"); // add cp to package.json "scripts"

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function verifyBasicSchema(db: Database): Promise<boolean> {
	const schemaSQL = await readFile(SCHEMA_PATH, "utf-8");

	// Extract table and index names using regex
	const objectNames = [
		...schemaSQL.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi),
		...schemaSQL.matchAll(/CREATE\s+INDEX\s+(\w+)\s+ON/gi),
	].map((match) => match[1]);

	// Get existing tables and indexes in the DB
	const rows = await db.all(`SELECT name FROM sqlite_master WHERE type IN ('table', 'index');`) as { name: string }[];
	const existingNames = rows.map((row) => row.name);

	// Find missing ones
	const missing = objectNames.filter((name) => !existingNames.includes(name));

	if (missing.length > 0) {
		console.warn("⚠️ Missing schema objects:", missing);
		return false;
	}

	return true;
}


function isDatabaseWritable(dbPath: string): Promise<boolean> {
	return new Promise((resolve) => {
		// Step 1: Check file and directory write permissions
		const dir = path.dirname(dbPath);

		// If the database file exists, check it directly; otherwise, check the directory
		const pathToCheck = fs.existsSync(dbPath) ? dbPath : dir;

		try {
			fs.accessSync(pathToCheck, fs.constants.W_OK);
		} catch (err) {
			// No write permission on file or directory
			return resolve(false);
		}

		// Step 2: Try to open in READWRITE mode
		const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
			if (err) {
				// Cannot open in read/write mode
				return resolve(false);
			}

			// Step 3: Try a dummy write (using a temporary table)
			db.run("CREATE TEMP TABLE writetest (id INTEGER)", (err) => {
				if (err) {
					db.close();
					return resolve(false);
				}

				db.run("DROP TABLE writetest", (dropErr) => {
					db.close();
					resolve(!dropErr);
				});
			});
		});
	});
}

export async function getDB(): Promise<Database | undefined> {
	sqlite3.verbose();

	const dbExists = await fileExists(DB_PATH);
	const db = await open({
		filename: DB_PATH,
		driver: sqlite3.Database,
	});

	if (!dbExists) {
		const schemaSQL = await readFile(SCHEMA_PATH, "utf-8");
		await db.exec(schemaSQL);
		console.log("Database created and initialized.");
	} else {
		const isValidSchema = await verifyBasicSchema(db);
		if (!isValidSchema) {
			console.error("Schema mismatch detected!!!\n Please correct the database and restart 77sq.");
			return undefined;
		} else {
			console.log("db Schema is valid.")
		}
		console.log("Database connection established.");
		// check if dataabse is in readonly mode (held by some other process)
		const dbIsWritable = await isDatabaseWritable(DB_PATH);
		if (dbIsWritable) {
			console.log("Database in ready for data.");
		} else {
			console.error("ERROR: Unable to write to database.\nCheck to insure no other process is using the sqlite file, you have write permissions, or the filesystem isn't full, and restart.");
		}
	}

	return db;
}
