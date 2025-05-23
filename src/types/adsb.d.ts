export interface ADSBResponse {
	ac?: Aircraft[];
	msg?: string;
	now?: number;
	total?: number;
	ctime?: number;
	ptime?: number;
}

export interface Aircraft {
	hex?: string;  // ICAO 24-bit aircraft address (hex)
	type?: string;  // //Probably radio source type  ====Aircraft type (e.g., A320, B738)
	flight?: string;  // Flight identifier (callsign)
	r?: string;  // Registration number
	t?: string;  // Aircraft type description: ICAO Aircraft Type Designation
	alt_baro?: number | string;  // Barometric altitude in feet
	alt_geom?: number;  // Geometric (GPS-based) altitude in feet
	gs?: number;  // Ground speed in knots
	track?: number;  // True track angle (heading) in degrees
	baro_rate?: number;  // Rate of climb/descent (barometric) in feet/min
	squawk?: string;  // Transponder squawk code (e.g., '7700')
	emergency?: string;  // Emergency code indicator (e.g., '7700')
	category?: string;  // Emitter Category ADS-B DO-260B 2.2.3.2.5.2
	lat?: number;  // Latitude
	lon?: number;  // Longitude
	rr_lon: number // latitude if no ADS-B or MLAT position available, a rough estimated position
	rr_lat: number // longitude if no ADS-B or MLAT position available, a rough estimated position
	nic?: number;  // Navigation Integrity Category
	rc?: number;  // Radius of Containment indicator
	seen_pos?: number;  // Seconds since last position update
	version?: number;  // ADS-B version
	nic_baro?: number;  // Barometric NIC (integrity)
	nac_p?: number;  // Navigation Accuracy Category for Position
	nac_v?: number;  // Navigation Accuracy Category for Velocity
	sil?: number;  // Source Integrity Level
	sil_type?: string;  // Type of SIL (per ADS-B spec)
	gva?: number;  // Geometric Vertical Accuracy
	sda?: number;  // System Design Assurance
	alert?: number;  // Alert flag (1 = alert, 0 = no alert)
	spi?: number;  // Special Position Identification (ident button)
	mlat?: any[];   // Multilateration data (from multiple ground stations)
	tisb?: any[];   // Traffic Information Service–Broadcast data
	messages?: number;  // Total messages received from this aircraft
	seen?: number;  // Seconds since last message seen
	rssi?: number;  // Signal strength (Received Signal Strength Indicator)
	nav_modes?: string[]; // set of engaged automation modes: ‘autopilot’, ‘vnav’, ‘althold’, ‘approach’, ‘lnav’, ‘tcas’

	// lastPosition: [Object],
	// "nav_modes":["autopilot","approach","tcas"]
}

// mlat[] ?
interface MlatReceiver {
	id: string;        // Unique identifier for the receiver station
	timestamp: number; // Time at which the signal was received (Unix timestamp)
	signalQuality?: number; // Optional: Signal quality metric (e.g., RSSI)

	// found in debug when type = 'mlat' and ac.mlat = any[]
	// gs
	// track
	// baro_rate
	// lat
	// lon
	// nic
	// rc
}

// tisb[] ?
interface TisbSource {
	id: string;               // Identifier for the relay ground station
	timestamp?: number;       // Optional: timestamp of relay
	feedType?: string;        // Optional: type of TIS-B source (e.g., radar, UAT)
}
