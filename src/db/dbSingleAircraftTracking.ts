import { Database } from 'sqlite';
import { Aircraft } from '../types';
import { handleAltBar } from '../etc/Handlers';

export async function dbSingleAircraftTracking(db: Database, ac: Aircraft, trackingId: string, seqNr: number) {
	// TODO: add console.error(s)
	if (!ac || !ac.hex || !trackingId) return;

	// const db = await open({
	// 	filename: 'adsb.sqlite',
	// 	driver: sqlite3.Database
	// });

	await db.exec('BEGIN TRANSACTION');

	try {
		let aircraftId: number | null | undefined = null;

		// Step 1: Find or insert aircraft by registration or fallback to hex
		if (ac.r) {
			// Try finding by registration
			const existing = await db.get(
				`SELECT id FROM aircraft WHERE registration = ?`,
				[ac.r]
			);

			if (existing) {
				aircraftId = existing.id;
			} else {
				// Insert with registration
				const result = await db.run(
					`INSERT INTO aircraft (registration, type, category, callsign, created_at, updated_at)
					 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
					[ac.r, ac.t ?? null, ac.category ?? null, ac.flight?.trim() ?? null]
				);
				aircraftId = result.lastID;
			}
		} else {
			// Fallback: Try finding by hex via transponder
			const existingByHex = await db.get(
				`SELECT a.id FROM aircraft a
				 JOIN transponders t ON a.id = t.aircraft_id
				 WHERE t.hex_code = ?`,
				[ac.hex]
			);

			if (existingByHex) {
				aircraftId = existingByHex.id;
			} else {
				// Insert new aircraft with null registration
				const result = await db.run(
					`INSERT INTO aircraft (registration, type, category, callsign, created_at, updated_at)
					 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
					[null, ac.t ?? null, ac.category ?? null, ac.flight?.trim() ?? null]
				);
				aircraftId = result.lastID;
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
		const alt_baro = handleAltBar(ac.alt_baro);

		await db.run(
			`INSERT INTO tracking_sessions (session_id, seqNr, aircraft_id, type, alt_baro, squawk, emergency_type, lat, lon, raw_json, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
			[
				trackingId,
				seqNr,
				aircraftId,
				ac.type ?? null,
				alt_baro ?? null,
				ac.squawk ?? null,
				ac.emergency ?? null,
				ac.lat ?? ac.rr_lat ?? null,
				ac.lon ?? ac.rr_lon ?? null,
				JSON.stringify(ac)
			]
		);

		await db.exec('COMMIT');
	} catch (err) {
		await db.exec('ROLLBACK');
		console.error('Error in dbSingleAircraftTracking:', err);
		throw err;
	} finally {
		// removed since moving db to root.
		// await db.close();
	}
}
