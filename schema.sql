CREATE TABLE IF NOT EXISTS sgw_couples (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sgw_weddings (
 id TEXT PRIMARY KEY, couple_id TEXT NOT NULL UNIQUE REFERENCES sgw_couples(id),
 slug TEXT NOT NULL UNIQUE, names TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sgw_invitations (
 id TEXT PRIMARY KEY, wedding_id TEXT NOT NULL REFERENCES sgw_weddings(id), token_hash TEXT NOT NULL UNIQUE,
 guest_name TEXT NOT NULL, max_guests INTEGER NOT NULL CHECK(max_guests BETWEEN 1 AND 20), revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(id,wedding_id)
);
CREATE TABLE IF NOT EXISTS sgw_rsvps (
 id TEXT PRIMARY KEY, wedding_id TEXT NOT NULL REFERENCES sgw_weddings(id), invitation_id TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, attendance TEXT NOT NULL CHECK(attendance IN ('yes','no')),
 guests INTEGER NOT NULL CHECK((attendance='yes' AND guests BETWEEN 1 AND 20) OR (attendance='no' AND guests=0)), message TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(invitation_id,wedding_id) REFERENCES sgw_invitations(id,wedding_id)
);
CREATE TABLE IF NOT EXISTS sgw_gifts (
 id TEXT PRIMARY KEY, wedding_id TEXT NOT NULL REFERENCES sgw_weddings(id), invitation_id TEXT NOT NULL,
 donor_name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('declaration','reservation')), item TEXT,
 amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(amount_minor BETWEEN 0 AND 10000000000), currency TEXT NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 status TEXT NOT NULL CHECK(status IN ('unverified','reserved','paid')), reference TEXT NOT NULL DEFAULT '',
 idempotency_key TEXT NOT NULL, provider_reference TEXT UNIQUE, verified_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK(status != 'paid' OR (provider_reference IS NOT NULL AND verified_at IS NOT NULL)),
 FOREIGN KEY(invitation_id,wedding_id) REFERENCES sgw_invitations(id,wedding_id), UNIQUE(invitation_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS sgw_one_reserved_item ON sgw_gifts(wedding_id,item) WHERE kind='reservation';
CREATE INDEX IF NOT EXISTS sgw_rsvps_wedding ON sgw_rsvps(wedding_id,updated_at);
CREATE INDEX IF NOT EXISTS sgw_gifts_wedding ON sgw_gifts(wedding_id,created_at);
CREATE INDEX IF NOT EXISTS sgw_invites_wedding ON sgw_invitations(wedding_id);
CREATE TABLE IF NOT EXISTS sgw_sessions (
 token_hash TEXT PRIMARY KEY, couple_id TEXT NOT NULL REFERENCES sgw_couples(id), expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sgw_sessions_expiry ON sgw_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sgw_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sgw_rates_expiry ON sgw_rate_limits(expires_at);
