import { Session } from "../types";

let sessions: Session[] = [];

export function getSessions(): Session[] {
	return sessions;
}

export function setSessions(newSessions: Session[]) {
	sessions = newSessions;
}

