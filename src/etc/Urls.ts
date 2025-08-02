// URL helpers
//
export function doc8643Url(aircraftType?: string): string | null {
	if (!aircraftType) {
		return null;
	}

	const designator = aircraftType.trim();

	return `https://www.doc8643.com/aircraft/${designator}`

}
