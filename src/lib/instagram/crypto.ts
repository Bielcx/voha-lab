const TOKEN_FORMAT_VERSION = "v1";
const IV_BYTES = 12;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importEncryptionKey(encodedKey: string) {
  const keyBytes = base64UrlToBytes(encodedKey);
  if (keyBytes.byteLength !== 32) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes.");
  }

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptAccessToken(token: string, encodedKey: string) {
  const key = await importEncryptionKey(encodedKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );

  return [
    TOKEN_FORMAT_VERSION,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(ciphertext)),
  ].join(".");
}

export async function decryptAccessToken(payload: string, encodedKey: string) {
  const [version, encodedIv, encodedCiphertext, extra] = payload.split(".");
  if (
    version !== TOKEN_FORMAT_VERSION ||
    !encodedIv ||
    !encodedCiphertext ||
    extra !== undefined
  ) {
    throw new Error("Unsupported encrypted token format.");
  }

  const iv = base64UrlToBytes(encodedIv);
  if (iv.byteLength !== IV_BYTES) throw new Error("Invalid encrypted token IV.");

  const key = await importEncryptionKey(encodedKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64UrlToBytes(encodedCiphertext),
  );

  return new TextDecoder().decode(plaintext);
}

export function createOAuthState() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
