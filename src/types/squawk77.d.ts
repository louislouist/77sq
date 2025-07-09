export interface Session {
	id: string;
	hex: string;
	endpoint: string;
	squawk: string;
	acType?: string;
	count: number;
	ground: boolean;
	approach: boolean;
	lastSeen: number;  // Unix epoch Date.now();
}

export interface ADSBLookup {
	type: ADSBQueryType;
	value: string
}

export type ADSBQueryType = 'squawk' | 'hex' | 'callsign' | 'registration' | 'type';

