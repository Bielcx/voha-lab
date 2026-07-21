import assert from "node:assert/strict";
import test from "node:test";

import {
  constantTimeEqual,
  createOAuthState,
  decryptAccessToken,
  encryptAccessToken,
} from "./crypto";

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

test("criptografa e descriptografa o token sem armazená-lo em texto puro", async () => {
  const token = "IGQVJ-token-secreto-de-teste";
  const encrypted = await encryptAccessToken(token, encryptionKey);

  assert.match(encrypted, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  assert.equal(encrypted.includes(token), false);
  assert.equal(await decryptAccessToken(encrypted, encryptionKey), token);
});

test("rejeita token criptografado adulterado", async () => {
  const encrypted = await encryptAccessToken("token", encryptionKey);
  const lastCharacter = encrypted.at(-1) === "A" ? "B" : "A";
  const tampered = `${encrypted.slice(0, -1)}${lastCharacter}`;

  await assert.rejects(() => decryptAccessToken(tampered, encryptionKey));
});

test("gera state imprevisível e compara sem atalho por tamanho", () => {
  const first = createOAuthState();
  const second = createOAuthState();

  assert.notEqual(first, second);
  assert.equal(constantTimeEqual(first, first), true);
  assert.equal(constantTimeEqual(first, second), false);
  assert.equal(constantTimeEqual(first, `${first}x`), false);
});
