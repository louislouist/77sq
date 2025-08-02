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
			<td>${renderAcHref(s.acType)}</td>
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

function renderAcHref(acType?: string): string {
	if (!acType) return 'N/A';
	const url = doc8643Url(acType);
	return `<a href="${url}">${acType}</a>`;
}
