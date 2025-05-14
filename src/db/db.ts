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
