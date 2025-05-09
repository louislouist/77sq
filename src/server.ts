import express from 'express';
import http from 'http';

const app = express();
const PORT = 3333;

let server: http.Server;

app.get('/', (_req, res) => {
	res.send('Hello from Express!');
});

export function startServer() {
	server = app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
}

export async function stopServer() {
	return new Promise<void>((resolve, reject) => {
		if (server) {
			server.close((err) => {
				if (err) return reject(err);
				console.log('Server closed.');
				resolve();
			});
		} else {
			resolve();
		}
	});
}
