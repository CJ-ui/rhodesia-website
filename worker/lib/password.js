// PBKDF2-HMAC-SHA256 password hashing via Web Crypto.
// Isomorphic: runs unchanged in the Worker (globalThis.crypto) and in Node
// via scripts/create-staff-user.mjs (Node's crypto.webcrypto), so both
// produce byte-identical hashes for the same password/salt.

const ITERATIONS = 210000;
const KEY_LENGTH_BITS = 256;

function toBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveBits(password, salt);
  return { hash: toBase64(derived), salt: toBase64(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const derived = await deriveBits(password, fromBase64(salt));
  const expected = fromBase64(hash);
  if (derived.length !== expected.length) return false;
  // constant-time comparison
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}
