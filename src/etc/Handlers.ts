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
