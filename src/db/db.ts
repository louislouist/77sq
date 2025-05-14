import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import { readFile } from "fs/promises";
import { access, constants } from "fs/promises";
import path from "path";

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

export async function getDB(): Promise<Database> {
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
		console.log("Database already exists.");
	}

	return db;
}
