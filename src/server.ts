import express, { Request, Response } from 'express';
import http from 'http';
import { Database } from 'sqlite';
import { dbQueue } from './db/queue/dbQueue';

const app = express();
const PORT = 3333;

let server: http.Server;

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

export function startServer(db: Database) {
	app.locals.db = db;

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
