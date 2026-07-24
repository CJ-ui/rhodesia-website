const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const ROBLOX_RE = /^[A-Za-z0-9_]{3,20}$/;
const DISCORD_MODERN_RE = /^[a-z0-9_.]{2,32}$/;
const DISCORD_LEGACY_RE = /^.{2,32}#[0-9]{4}$/;

export function validateUsername(value) {
  if (typeof value !== "string" || !USERNAME_RE.test(value)) {
    return "Username must be 3-20 characters: letters, numbers, and underscores only.";
  }
  return null;
}

export function validatePassword(password, confirmPassword) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password !== confirmPassword) {
    return "Password and confirmation do not match.";
  }
  return null;
}

export function validateRobloxUsername(value) {
  if (typeof value !== "string" || !ROBLOX_RE.test(value)) {
    return "Enter a valid Roblox username (3-20 characters, letters/numbers/underscore).";
  }
  return null;
}

export function validateDiscordHandle(value) {
  if (typeof value !== "string" || !(DISCORD_MODERN_RE.test(value) || DISCORD_LEGACY_RE.test(value))) {
    return "Enter a valid Discord handle (e.g. username or name#1234).";
  }
  return null;
}

export function validateMailSubject(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "A subject is required.";
  }
  if (value.trim().length > 150) {
    return "Subject must be 150 characters or fewer.";
  }
  return null;
}

export function validateMailBody(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "A message is required.";
  }
  if (value.length > 5000) {
    return "Message must be 5000 characters or fewer.";
  }
  return null;
}

export function validateRegistration(body) {
  return (
    validateUsername(body.username) ||
    validatePassword(body.password, body.confirmPassword) ||
    validateRobloxUsername(body.robloxUsername) ||
    validateDiscordHandle(body.discordHandle) ||
    null
  );
}
