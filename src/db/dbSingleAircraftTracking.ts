import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { Aircraft, handleAltBar } from '../types';

export async function dbSingleAircraftTracking(ac: Aircraft, trackingId: string) {
	// TODO: add console.error
	if (!ac || !ac.hex || !trackingId) return;

	const db = await open({
		filename: 'adsb.sqlite',
		driver: sqlite3.Database
	});

	await db.exec('BEGIN TRANSACTION');

	try {
		let aircraftId: number | null = null;

		// Step 1: Insert or find aircraft (if registration exists)
		if (ac.r) {
			const existing = await db.get(
				`SELECT id FROM aircraft WHERE registration = ?`,
				[ac.r]
			);

			if (existing) {
				aircraftId = existing.id;
			} else {
				const result = await db.run(
					`INSERT INTO aircraft (registration, type, category, callsign, created_at, updated_at)
   VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
					[ac.r, ac.t ?? null, ac.category ?? null, ac.flight?.trim() ?? null]
				);

				aircraftId = typeof result.lastID === 'number' ? result.lastID : null;
			}
		}

		// Step 2: Upsert transponder
		await db.run(
			`INSERT INTO transponders (hex_code, aircraft_id, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(hex_code) DO UPDATE SET
         aircraft_id = excluded.aircraft_id,
         updated_at = datetime('now')`,
			[ac.hex, aircraftId]
		);

		// Step 3: Insert tracking session
		// alt_baro can sometimes be a string ("ground").
		//     this converts the string to a number for the db.
		const alt_baro = handleAltBar(ac.alt_baro);

		await db.run(
			`INSERT INTO tracking_sessions (id, aircraft_id, type, alt_baro, squawk, emergency_type, lat, lon, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
			[
				trackingId,
				aircraftId,
				ac.type ?? null,
				alt_baro ?? null,
				ac.squawk ?? null,
				ac.emergency ?? null,
				ac.lat ?? null,
				ac.lon ?? null,
				JSON.stringify(ac)
			]
		);

		await db.exec('COMMIT');
	} catch (err) {
		await db.exec('ROLLBACK');
		throw err;
	} finally {
		await db.close();
	}
}
