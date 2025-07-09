import { Database } from "sqlite";
import { ADSBLookup, ADSBQueryType } from "../types";
import { dbQueue } from "./queue/dbQueue";

export async function getTrackable(db: Database): Promise<ADSBLookup[]> {
	const rows: Array<{
		type: ADSBQueryType;
		squawk: string | null;
		hex: string | null;
		callsign: string | null;
		registration: string | null;
		aircraft_type: string | null;
	}> = await dbQueue.all(
		db,
		`
		SELECT adsb_query_type AS type,
		       squawk,
		       hex,
		       callsign,
		       registration,
		       type AS aircraft_type
		FROM adsb_endpoints
		WHERE is_enabled = 1
	`,
		[], // no SQL parameters
		1   // optional priority
	);

	const trackable: ADSBLookup[] = rows
		.map((row): ADSBLookup | null => {
			let value: string | null = null;

			switch (row.type) {
				case 'squawk':
					value = row.squawk;
					break;
				case 'hex':
					value = row.hex;
					break;
				case 'callsign':
					value = row.callsign;
					break;
				case 'registration':
					value = row.registration;
					break;
				case 'type':
					value = row.aircraft_type;
					break;
			}

			return value ? { type: row.type, value } : null;
		})
		.filter((entry): entry is ADSBLookup => entry !== null);

	// No need to close DB here — AdvancedJobQueue assumes long-lived db instance
	return trackable;
}
