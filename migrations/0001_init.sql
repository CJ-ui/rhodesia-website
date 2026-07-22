CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  roblox_username TEXT NOT NULL,
  discord_handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE login_attempts (
  username TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  success INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_login_attempts_username_time ON login_attempts(username, attempted_at);

CREATE TABLE staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE staff_sessions (
  token TEXT PRIMARY KEY,
  staff_user_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_staff_sessions_staff_user ON staff_sessions(staff_user_id);

CREATE TABLE staff_login_attempts (
  username TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  success INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_staff_login_attempts_username_time ON staff_login_attempts(username, attempted_at);
