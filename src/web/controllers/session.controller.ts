import { Request, Response } from 'express';
import { getSessions, getSessionsSortedByLastSeen } from '../sessionStore';
import { doc8643Url } from '../../etc/Urls';

export const getSessionsJson = (_req: Request, res: Response) => {
	const sessions = getSessions();

	const formatted = sessions.map(s => ({
		...s,
		lastSeen: new Date(s.lastSeen).toISOString(),
	}));

	res.json(formatted);
};

export const getSessionsHtml = (_req: Request, res: Response) => {
	const sessions = getSessionsSortedByLastSeen();

	const rows = sessions.map(s => `
		<tr>
			<td>${s.id}</td>
			<td>${s.hex}</td>
			<td>${s.endpoint}</td>
			<td>${s.squawk}</td>
			<td>${s.acType ? `<a href="${doc8643Url(s.acType)}">${s.acType}</a>` : 'N/A'}</td>
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
};
