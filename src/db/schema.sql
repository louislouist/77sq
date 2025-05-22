-- aircraft
CREATE TABLE IF NOT EXISTS aircraft (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	registration TEXT,
	type TEXT,
	callsign TEXT,
	category TEXT,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- transponders
CREATE TABLE IF NOT EXISTS transponders (
	hex_code TEXT PRIMARY KEY,
	aircraft_id INTEGER,
	created_at TEXT DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (aircraft_id) REFERENCES aircraft(id) ON DELETE SET NULL
);

-- tracking_sessions
CREATE TABLE IF NOT EXISTS tracking_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,     -- Unique row ID
    session_id TEXT NOT NULL,                 -- Session identifier (can repeat)
    seqNr INTEGER NOT NULL,                   -- Sequence number for the session
    aircraft_id INTEGER NOT NULL,             -- Aircraft being tracked
    type TEXT,
    alt_baro INTEGER,
    squawk TEXT,
    emergency_type TEXT,
    lat REAL,
    lon REAL,
    raw_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (aircraft_id) REFERENCES aircraft(id)
);

-- socials
CREATE TABLE IF NOT EXISTS social_platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Add platforms
INSERT OR IGNORE INTO social_platforms (name) VALUES
('Reddit'),
('Telegram'),
('Bluesky');

-- social posts
CREATE TABLE IF NOT EXISTS social_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_session_id INTEGER,
    platform_id INTEGER,
    channel TEXT,
    title TEXT,
    message TEXT,
    status TEXT,                    -- e.g., 'posted', 'failed', 'queued'
    external_id TEXT,               -- ID or URL of the post on the platform
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tracking_session_id) REFERENCES tracking_sessions(id),
    FOREIGN KEY (platform_id) REFERENCES social_platforms(id)
);

-- Indexing for session or aircraft
CREATE INDEX idx_tracking_sessions_session_id ON tracking_sessions(session_id);
CREATE INDEX idx_tracking_sessions_aircraft_id ON tracking_sessions(aircraft_id);

