import { fetchADSB } from "./fetchADSB";

let running = true;

export async function sq77() {
	while (running) {
		const a77 = await fetchADSB();
		if (a77) {
			console.log(a77);
			a77.ac?.map((ac) => {
				ac.mlat?.map((lat) => {
					console.log(lat);
				})
			})
		}

		console.log("sq77() dev mode 10s when nothing in response.ac");
		const timeout = (a77?.ac?.length ?? 0) > 0 ? 6000 : 10000; // TODO: change to 60000 in prod.
		await new Promise((resolve) => setTimeout(resolve, timeout));
	}
	console.log("stopped sq77()");
}

export async function stopSq77() {
	running = false;
}
