-- Internal correspondence system: citizen <-> government (staff, collectively).
-- A thread always has exactly one citizen on one side and the government on the
-- other. Staff act collectively, so read/delete state is tracked per-side at the
-- thread level rather than per individual staff member.

CREATE TABLE mail_threads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  citizen_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'correspondence' CHECK (kind IN ('correspondence','notice')),
  started_by      TEXT NOT NULL CHECK (started_by IN ('citizen','staff')),
  last_message_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  last_sender_type TEXT NOT NULL CHECK (last_sender_type IN ('citizen','staff')),
  citizen_read_at TEXT,
  staff_read_at   TEXT,
  citizen_deleted INTEGER NOT NULL DEFAULT 0,
  staff_deleted   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX idx_mail_threads_citizen ON mail_threads(citizen_id, last_message_at);
CREATE INDEX idx_mail_threads_last ON mail_threads(last_message_at);

CREATE TABLE mail_messages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id         INTEGER NOT NULL REFERENCES mail_threads(id) ON DELETE CASCADE,
  sender_type       TEXT NOT NULL CHECK (sender_type IN ('citizen','staff')),
  sender_citizen_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_staff_id   INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  sender_name       TEXT NOT NULL,
  body              TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX idx_mail_messages_thread ON mail_messages(thread_id, created_at);

CREATE TABLE mail_send_attempts (
  actor        TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX idx_mail_send_attempts_actor_time ON mail_send_attempts(actor, attempted_at);
