import express, { Request, Response } from 'express';
import { Server } from 'http';
import { Database } from 'sqlite';
import { dbQueue } from '../db/queue/dbQueue';
import { getSessions } from './sessionStore';

const app = express();
const MAX_PORT_RETRIES = 10;

let server: Server;

interface Version {
	version: string;
}

app.get('/', (_req, res) => {
	res.send('Hello from 77sq!');
});

app.get('/tracking', async (req: Request, res: Response) => {
	const db = req.app.locals.db;

	try {
		const items = await db.all('SELECT sqlite_version() AS version');
		const ver = await dbQueue.all<Version[]>(db, 'SELECT sqlite_version() AS version');

		const html = `<!DOCTYPE html>
    <html>
      <head><title>Item List</title></head>
      <body>
        <h1>Items</h1>
        <ul>
          <li>SQLite version ${items[0].version}</li>
<li>all version ${ver[0].version}</li>
        </ul>
      </body>
    </html>`;

		res.send(html);
	} catch (err) {
		console.error("Error fetching data: ", err);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/sessions', (_req: Request, res: Response) => {
	const sessions = getSessions();

	// Optionally format for display
	const formatted = sessions.map(s => ({
		...s,
		lastSeen: new Date(s.lastSeen).toISOString(), // or any formatting
	}));

	res.json(formatted);
});

app.get('/sessions/html', (_req, res) => {
	const sessions = getSessions();

	const rows = sessions.map(s => `
		<tr>
			<td>${s.id}</td>
			<td>${s.hex}</td>
			<td>${s.endpoint}</td>
			<td>${s.squawk}</td>
			<td>${s.acType || 'N/A'}</td>
			<td>${s.count}</td>
			<td>${s.ground}</td>
			<td>${s.approach}</td>
			<td>${new Date(s.lastSeen).toISOString()}</td>
		</tr>
	`).join('');

	const html = `
		<html>
		<head><title>Sessions</title></head>
		<body>
			<h1>Active Sessions</h1>
			<table border="1">
				<tr>
					<th>ID</th><th>Hex</th><th>Endpoint</th><th>Squawk</th><th>Type</th>
					<th>Count</th><th>Ground</th><th>Approach</th><th>Last Seen</th>
				</tr>
				${rows}
			</table>
		</body>
		</html>
	`;

	res.send(html);
});

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
