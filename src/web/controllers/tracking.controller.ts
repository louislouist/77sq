import { Request, Response } from "express";
import { dbQueue } from "../../db/queue/dbQueue";

interface Version {
	version: string;
}

export const getTrackingInfo = async (req: Request, res: Response) => {
	const db = req.app.locals.db;

	try {
		const items = await db.all('SELECT sqlite_version() AS version');
		const ver = await dbQueue.all<Version[]>(db, 'SELECT sqlite_version() AS version');

		const html = `
			<!DOCTYPE html>
			<html>
				<head><title>Tracking Info</title></head>
				<body>
					<h1>Items</h1>
					<ul>
						<li>SQLite version ${items[0].version}</li>
						<li>All version ${ver[0].version}</li>
					</ul>
				</body>
			</html>`;

		res.send(html);
	} catch (err) {
		console.error("Error fetching tracking info: ", err);
		res.status(500).send('Internal Server Error');
	}
};
