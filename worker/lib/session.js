// Generic session helpers, parameterized so citizen and staff sessions never
// share a table, a cookie name, or a cookie Path — keeps the two privilege
// domains structurally separate instead of relying on a role check.

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return cookies;
}

export function makeSessionStore({ db, table, userIdColumn, cookieName, cookiePath }) {
  return {
    async create(userId) {
      const token = randomToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
      await db
        .prepare(`INSERT INTO ${table} (token, ${userIdColumn}, expires_at) VALUES (?, ?, ?)`)
        .bind(token, userId, expiresAt)
        .run();
      return { token, expiresAt };
    },

    async validate(request) {
      const token = parseCookies(request)[cookieName];
      if (!token) return null;
      const row = await db
        .prepare(`SELECT * FROM ${table} WHERE token = ? AND expires_at > CURRENT_TIMESTAMP`)
        .bind(token)
        .first();
      return row || null;
    },

    async destroy(request) {
      const token = parseCookies(request)[cookieName];
      if (token) {
        await db.prepare(`DELETE FROM ${table} WHERE token = ?`).bind(token).run();
      }
    },

    setCookieHeader(token) {
      return `${cookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Path=${cookiePath}; Max-Age=${SESSION_TTL_SECONDS}`;
    },

    clearCookieHeader() {
      return `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=${cookiePath}; Max-Age=0`;
    },
  };
}
