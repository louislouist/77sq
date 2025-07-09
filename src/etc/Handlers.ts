export function handleAltBar(alt_bar: number | string | undefined): number | null {
	if (alt_bar === undefined) return null;

	if (typeof alt_bar === "string") {
		if (alt_bar === "ground") {
			return -7777;
		} else {
			console.log(`handleAltBar() value set -999: ${alt_bar}`);
			return -9999;
		}
	}

	return alt_bar;
}

export function getRandomNumber(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function lineBreak(length: number, label = '', char = '-') {
	const lable_length = label.length;
	const line = char.repeat(length - lable_length);
	console.log(`${line}${label ? ' ' + label + ' ' + line : line}`);
}

export function shortSessionId(sessionId: string): string {
	if (sessionId.length <= 10) return sessionId;
	const firstFive = sessionId.slice(0, 5);
	const lastFive = sessionId.slice(-5);
	return `${firstFive}...${lastFive}`;
}

