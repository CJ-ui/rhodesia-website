import { hashPassword, verifyPassword } from "./lib/password.js";
import { makeSessionStore } from "./lib/session.js";
import { validateRegistration } from "./lib/validate.js";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function errorJson(message, status) {
  return json({ error: message }, status);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function isRateLimited(db, attemptsTable, username) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM ${attemptsTable}
       WHERE username = ? AND success = 0
       AND attempted_at > datetime('now', '-${RATE_LIMIT_WINDOW_MINUTES} minutes')`
    )
    .bind(username)
    .first();
  return (row?.count || 0) >= RATE_LIMIT_MAX_ATTEMPTS;
}

async function recordAttempt(db, attemptsTable, username, success) {
  await db
    .prepare(`INSERT INTO ${attemptsTable} (username, success) VALUES (?, ?)`)
    .bind(username, success ? 1 : 0)
    .run();
}

async function recordAudit(db, actor, action, target) {
  await db
    .prepare(`INSERT INTO audit_log (actor, action, target) VALUES (?, ?, ?)`)
    .bind(actor, action, target ?? null)
    .run();
}

// ---------------------------------------------------------------------------
// Citizens Portal
// ---------------------------------------------------------------------------

async function handleCitizenRegister(request, env) {
  const body = await readJsonBody(request);
  const validationError = validateRegistration(body);
  if (validationError) return errorJson(validationError, 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(body.username)
    .first();
  if (existing) return errorJson("Username already taken", 409);

  const { hash, salt } = await hashPassword(body.password);
  await env.DB.prepare(
    `INSERT INTO users (username, password_hash, password_salt, roblox_username, discord_handle)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(body.username, hash, salt, body.robloxUsername, body.discordHandle)
    .run();

  return json({ status: "pending" }, 201);
}

async function handleCitizenLogin(request, env, sessions) {
  const body = await readJsonBody(request);
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (await isRateLimited(env.DB, "login_attempts", username)) {
    return errorJson("Too many attempts, try again later", 429);
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  const valid = user ? await verifyPassword(password, user.password_hash, user.password_salt) : false;

  await recordAttempt(env.DB, "login_attempts", username, valid);

  if (!user || !valid) {
    return errorJson("Invalid username or password", 401);
  }

  if (user.status !== "active") {
    const message = user.status === "rejected" ? "Account was rejected" : "Account is pending review";
    return errorJson(message, 403);
  }

  const { token } = await sessions.create(user.id);
  return json({ username: user.username, status: user.status }, 200, {
    "Set-Cookie": sessions.setCookieHeader(token),
  });
}

async function handleCitizenLogout(request, env, sessions) {
  await sessions.destroy(request);
  return json({}, 200, { "Set-Cookie": sessions.clearCookieHeader() });
}

async function handleCitizenMe(request, env, sessions) {
  const session = await sessions.validate(request);
  if (!session) return errorJson("Not logged in", 401);
  const user = await env.DB.prepare(
    "SELECT username, roblox_username, discord_handle, status FROM users WHERE id = ?"
  )
    .bind(session.user_id)
    .first();
  if (!user) return errorJson("Not logged in", 401);
  return json({
    username: user.username,
    robloxUsername: user.roblox_username,
    discordHandle: user.discord_handle,
    status: user.status,
  });
}

// ---------------------------------------------------------------------------
// Group & Community Management (staff)
// ---------------------------------------------------------------------------

async function handleStaffLogin(request, env, staffSessions) {
  const body = await readJsonBody(request);
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (await isRateLimited(env.DB, "staff_login_attempts", username)) {
    return errorJson("Too many attempts, try again later", 429);
  }

  const staff = await env.DB.prepare("SELECT * FROM staff_users WHERE username = ?").bind(username).first();
  const valid = staff ? await verifyPassword(password, staff.password_hash, staff.password_salt) : false;

  await recordAttempt(env.DB, "staff_login_attempts", username, valid);

  if (!staff || !valid) {
    return errorJson("Invalid username or password", 401);
  }

  const { token } = await staffSessions.create(staff.id);
  await recordAudit(env.DB, staff.username, "login");
  return json({ username: staff.username, displayName: staff.display_name }, 200, {
    "Set-Cookie": staffSessions.setCookieHeader(token),
  });
}

async function handleStaffLogout(request, env, staffSessions) {
  const staff = await requireStaff(request, env, staffSessions);
  await staffSessions.destroy(request);
  if (staff) await recordAudit(env.DB, staff.username, "logout");
  return json({}, 200, { "Set-Cookie": staffSessions.clearCookieHeader() });
}

async function requireStaff(request, env, staffSessions) {
  const session = await staffSessions.validate(request);
  if (!session) return null;
  const staff = await env.DB.prepare("SELECT * FROM staff_users WHERE id = ?")
    .bind(session.staff_user_id)
    .first();
  return staff || null;
}

async function handleStaffMe(request, env, staffSessions) {
  const staff = await requireStaff(request, env, staffSessions);
  if (!staff) return errorJson("Not logged in", 401);
  return json({ username: staff.username, displayName: staff.display_name });
}

async function handlePendingCitizens(request, env, staffSessions) {
  const staff = await requireStaff(request, env, staffSessions);
  if (!staff) return errorJson("Not logged in", 401);

  const { results } = await env.DB.prepare(
    `SELECT id, username, roblox_username, discord_handle, created_at
     FROM users WHERE status = 'pending' ORDER BY created_at ASC`
  ).all();

  return json({
    users: results.map((u) => ({
      id: u.id,
      username: u.username,
      robloxUsername: u.roblox_username,
      discordHandle: u.discord_handle,
      createdAt: u.created_at,
    })),
  });
}

async function handleCitizenReview(request, env, staffSessions) {
  const staff = await requireStaff(request, env, staffSessions);
  if (!staff) return errorJson("Not logged in", 401);

  const body = await readJsonBody(request);
  const userId = Number(body.userId);
  const action = body.action;
  if (!Number.isInteger(userId) || (action !== "approve" && action !== "reject")) {
    return errorJson("Invalid request", 400);
  }

  const newStatus = action === "approve" ? "active" : "rejected";
  const target = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first();
  const result = await env.DB.prepare(
    `UPDATE users SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
     WHERE id = ? AND status = 'pending'`
  )
    .bind(newStatus, staff.username, userId)
    .run();

  if (result.meta.changes === 0) {
    return errorJson("No pending account found for that id", 404);
  }

  await recordAudit(env.DB, staff.username, action === "approve" ? "approve_citizen" : "reject_citizen", target?.username);

  return json({ id: userId, status: newStatus });
}

async function handleListStaff(request, env, staffSessions) {
  const staff = await requireStaff(request, env, staffSessions);
  if (!staff) return errorJson("Not logged in", 401);

  const { results } = await env.DB.prepare(
    "SELECT username, display_name, created_at FROM staff_users ORDER BY created_at ASC"
  ).all();

  return json({
    staff: results.map((s) => ({
      username: s.username,
      displayName: s.display_name,
      createdAt: s.created_at,
    })),
  });
}

async function handleCreateStaff(request, env, staffSessions) {
  const requestingStaff = await requireStaff(request, env, staffSessions);
  if (!requestingStaff) return errorJson("Not logged in", 401);

  const body = await readJsonBody(request);
  const usernameError = typeof body.username !== "string" || !/^[A-Za-z0-9_]{3,20}$/.test(body.username)
    ? "Username must be 3-20 characters: letters, numbers, and underscores only."
    : null;
  if (usernameError) return errorJson(usernameError, 400);
  if (typeof body.password !== "string" || body.password.length < 8) {
    return errorJson("Password must be at least 8 characters.", 400);
  }
  if (body.password !== body.confirmPassword) {
    return errorJson("Password and confirmation do not match.", 400);
  }
  if (typeof body.displayName !== "string" || body.displayName.trim().length === 0) {
    return errorJson("Display name is required.", 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM staff_users WHERE username = ?")
    .bind(body.username)
    .first();
  if (existing) return errorJson("Username already taken", 409);

  const { hash, salt } = await hashPassword(body.password);
  await env.DB.prepare(
    "INSERT INTO staff_users (username, password_hash, password_salt, display_name) VALUES (?, ?, ?, ?)"
  )
    .bind(body.username, hash, salt, body.displayName.trim())
    .run();

  await recordAudit(env.DB, requestingStaff.username, "create_staff", body.username);

  return json({ username: body.username, displayName: body.displayName.trim() }, 201);
}

async function handleAuditLog(request, env, staffSessions) {
  const staff = await requireStaff(request, env, staffSessions);
  if (!staff) return errorJson("Not logged in", 401);

  const { results } = await env.DB.prepare(
    "SELECT actor, action, target, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 200"
  ).all();

  return json({
    entries: results.map((e) => ({
      actor: e.actor,
      action: e.action,
      target: e.target,
      createdAt: e.created_at,
    })),
  });
}

// ---------------------------------------------------------------------------
// Dashboard page gating
// ---------------------------------------------------------------------------

async function guardDashboard(request, env, sessions, loginPath) {
  const session = await sessions.validate(request);
  if (!session) {
    return Response.redirect(new URL(loginPath, request.url).toString(), 302);
  }
  return null; // fall through to static asset
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    // Cloudflare's static-asset serving canonicalizes /foo.html <-> /foo; gate
    // on the extension-stripped form so dashboard auth can't be bypassed by
    // requesting whichever form isn't explicitly listed in run_worker_first.
    const canonicalPath = pathname.replace(/\.html$/, "");
    const method = request.method;

    const citizenSessions = makeSessionStore({
      db: env.DB,
      table: "sessions",
      userIdColumn: "user_id",
      cookieName: "portal_session",
      cookiePath: "/citizens-portal",
    });

    const staffSessions = makeSessionStore({
      db: env.DB,
      table: "staff_sessions",
      userIdColumn: "staff_user_id",
      cookieName: "staff_session",
      cookiePath: "/group-community-management",
    });

    try {
      // --- Citizens Portal API ---
      if (pathname === "/citizens-portal/api/register" && method === "POST") {
        return await handleCitizenRegister(request, env);
      }
      if (pathname === "/citizens-portal/api/login" && method === "POST") {
        return await handleCitizenLogin(request, env, citizenSessions);
      }
      if (pathname === "/citizens-portal/api/logout" && method === "POST") {
        return await handleCitizenLogout(request, env, citizenSessions);
      }
      if (pathname === "/citizens-portal/api/me" && method === "GET") {
        return await handleCitizenMe(request, env, citizenSessions);
      }

      // --- Citizens dashboard gating ---
      if (canonicalPath === "/citizens-portal/dashboard") {
        const redirect = await guardDashboard(request, env, citizenSessions, "/citizens-portal/login.html");
        if (redirect) return redirect;
        return env.ASSETS.fetch(request);
      }

      // --- Group & Community Management API ---
      if (pathname === "/group-community-management/api/login" && method === "POST") {
        return await handleStaffLogin(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/logout" && method === "POST") {
        return await handleStaffLogout(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/me" && method === "GET") {
        return await handleStaffMe(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/citizens/pending" && method === "GET") {
        return await handlePendingCitizens(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/citizens/review" && method === "POST") {
        return await handleCitizenReview(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/staff" && method === "GET") {
        return await handleListStaff(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/staff" && method === "POST") {
        return await handleCreateStaff(request, env, staffSessions);
      }
      if (pathname === "/group-community-management/api/audit-log" && method === "GET") {
        return await handleAuditLog(request, env, staffSessions);
      }

      // --- Staff dashboard gating ---
      if (canonicalPath === "/group-community-management/dashboard") {
        const redirect = await guardDashboard(
          request,
          env,
          staffSessions,
          "/group-community-management/login.html"
        );
        if (redirect) return redirect;
        return env.ASSETS.fetch(request);
      }

      // --- Everything else: static assets ---
      return env.ASSETS.fetch(request);
    } catch (err) {
      return errorJson(`Internal error: ${err.message}`, 500);
    }
  },
};
