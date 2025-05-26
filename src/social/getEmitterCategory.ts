// const emitterCategoryMap: Record<number, string> = {
// 	0: "No ADS-B Emitter Category Information",
// 	1: "Light (< 15,500 lbs)",
// 	2: "Small (15,500 lbs to 75,000 lbs)",
// 	3: "Large (> 75,000 lbs)",
// 	4: "High-Vortex Large",
// 	5: "Heavy (> 255,000 lbs)",
// 	6: "High Performance (> 5g acceleration and 400 kts)",
// 	7: "Rotorcraft",
// 	8: "Glider / Sailplane",
// 	9: "Lighter-than-Air",
// 	10: "Unmanned Aerial Vehicle",
// 	11: "Space / Trans-atmospheric vehicle",
// 	12: "Surface Vehicle – Emergency Vehicle",
// 	13: "Surface Vehicle – Service Vehicle",
// 	14: "Point Obstacle (e.g., tower, crane)",
// 	15: "Cluster Obstacle (e.g., group of towers)"
// };
//
// export function getEmitterCategoryInfo(input: string): string {
// 	// Match patterns like "A3", "Category: A3", etc.
// 	const match = input.match(/A([0-9A-F])/i);
// 	if (!match) {
// 		return "Emitter Category code not found or invalid format.";
// 	}
//
// 	const hexDigit = match[1];
// 	const code = parseInt(hexDigit, 16);
//
// 	return emitterCategoryMap[code] ?? "Unknown Emitter Category.";
// }
