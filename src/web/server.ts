import express from 'express';
import { Server } from 'http';
import { Database } from 'sqlite';
import rootRoutes from './routes/root.routes';
import sessionRoutes from './routes/session.routes';
import trackingRoutes from './routes/tracking.routes';

const app = express();
const MAX_PORT_RETRIES = 10;

let server: Server;

// app.get('/', (_req, res) => {
// 	res.send('Hello from 77sq!');
// });

app.use('/', rootRoutes);
app.use('/tracking', trackingRoutes);
app.use('/sessions', sessionRoutes);

export async function startServer(db: Database, startingPort: number = 3000): Promise<Server | null> {
	app.locals.db = db;

	for (let i = 0; i < MAX_PORT_RETRIES; i++) {
		const portToTry = startingPort + i;

		try {
			await new Promise<void>((resolve, reject) => {
				server = app.listen(portToTry)
					.on('listening', () => {
						console.log(`Server is running on http://localhost:${portToTry}`);
						resolve();
					})
					.on('error', (err: NodeJS.ErrnoException) => {
						if (err.code === 'EADDRINUSE') {
							console.warn(`Port ${portToTry} is in use. Trying next...`);
							resolve(); // still resolve to move on to next port
						} else {
							reject(err); // actual error
						}
					});
			});

			// If server is successfully listening, exit loop
			if (server.listening) {
				return server;
			}

		} catch (err) {
			console.error(`Failed to start server: ${(err as Error).message}`);
			return null;
		}
	}

	console.error(`All ${MAX_PORT_RETRIES} ports (${startingPort}–${startingPort + MAX_PORT_RETRIES - 1}) are in use.`);
	return null;
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
