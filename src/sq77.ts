let running = true;

export async function sq77() {
	while (running) {
		console.log('Running squawk77 task...');
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}
	console.log("stopped sq77()");
}

export async function stopSq77() {
	running = false;
}
