import assert from "node:assert/strict";
import test from "node:test";

import { verifyMetaSignedRequest } from "./signed-request";

function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  return Buffer.from(bytes).toString("base64url");
}

async function createSignedRequest(payload: object, secret: string) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(encodedPayload),
    ),
  );
  return `${toBase64Url(signature)}.${encodedPayload}`;
}

test("aceita callback da Meta com assinatura válida", async () => {
  const secret = "meta-app-secret-test";
  const signedRequest = await createSignedRequest(
    { algorithm: "HMAC-SHA256", user_id: "123456" },
    secret,
  );

  const result = await verifyMetaSignedRequest(signedRequest, secret);
  assert.equal(result.user_id, "123456");
});

test("rejeita callback da Meta adulterado", async () => {
  const secret = "meta-app-secret-test";
  const signedRequest = await createSignedRequest(
    { algorithm: "HMAC-SHA256", user_id: "123456" },
    secret,
  );
  const tampered = `${signedRequest.slice(0, -1)}A`;

  await assert.rejects(
    () => verifyMetaSignedRequest(tampered, secret),
    /meta_signed_request_signature_invalid/u,
  );
});
