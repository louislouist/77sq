import { Session } from "../types";

let sessions: Session[] = [];

export function getSessions(): Session[] {
	return sessions;
}

export function getSessionsSortedByLastSeen(): Session[] {
	return sessions.sort((a, b) => b.lastSeen - a.lastSeen);
}

export function setSessions(newSessions: Session[]) {
	sessions = newSessions;
}

