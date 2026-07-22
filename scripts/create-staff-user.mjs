#!/usr/bin/env node
// Bootstraps a staff account for Group & Community Management.
//
// Usage:
//   node scripts/create-staff-user.mjs <username> <password> "<Display Name>"
//
// Prints a `wrangler d1 execute` command you can run to insert the account.
// Uses the exact same PBKDF2 hashing code as the Worker (worker/lib/password.js),
// so the hash this produces is guaranteed compatible with the login endpoint.

import { hashPassword } from "../worker/lib/password.js";

const [, , username, password, displayName] = process.argv;

if (!username || !password || !displayName) {
  console.error('Usage: node scripts/create-staff-user.mjs <username> <password> "<Display Name>"');
  process.exit(1);
}

if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
  console.error("Username must be 3-20 characters: letters, numbers, and underscores only.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const { hash, salt } = await hashPassword(password);

const escapedUsername = username.replace(/'/g, "''");
const escapedDisplayName = displayName.replace(/'/g, "''");

const sql =
  `INSERT INTO staff_users (username, password_hash, password_salt, display_name) ` +
  `VALUES ('${escapedUsername}', '${hash}', '${salt}', '${escapedDisplayName}');`;

console.log("\nRun this command to create the staff account (use --local for local dev, --remote for production):\n");
console.log(`wrangler d1 execute rhodesia-citizens --remote --command="${sql}"\n`);
