import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKSPACE_MEDIA_LIMIT_BYTES,
  canEditMedia,
  isWorkspaceMediaKey,
  validateUploadCandidate,
  validateWorkspaceUploadCapacity,
} from "./policy";

test("aceita uma imagem JPEG dentro do limite", () => {
  const result = validateUploadCandidate({
    fileName: "campanha-inverno.jpg",
    contentType: "image/jpeg",
    sizeBytes: 3 * 1024 * 1024,
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.kind, "image");
    assert.equal(result.contentType, "image/jpeg");
  }
});

test("rejeita MIME não permitido e extensão incompatível", () => {
  const unsupported = validateUploadCandidate({
    fileName: "arquivo.svg",
    contentType: "image/svg+xml",
    sizeBytes: 1000,
  });
  const mismatched = validateUploadCandidate({
    fileName: "video.jpg",
    contentType: "video/mp4",
    sizeBytes: 1000,
  });

  assert.equal(unsupported.valid, false);
  assert.equal(mismatched.valid, false);
});

test("rejeita arquivos acima do limite do tipo", () => {
  const image = validateUploadCandidate({
    fileName: "foto.webp",
    contentType: "image/webp",
    sizeBytes: 26 * 1024 * 1024,
  });
  const video = validateUploadCandidate({
    fileName: "reel.mp4",
    contentType: "video/mp4",
    sizeBytes: 201 * 1024 * 1024,
  });

  assert.equal(image.valid, false);
  assert.equal(video.valid, false);
});

test("somente owner e editor podem alterar mídias", () => {
  assert.equal(canEditMedia("owner"), true);
  assert.equal(canEditMedia("editor"), true);
  assert.equal(canEditMedia("approver"), false);
});

test("aceita somente chaves da pasta de mídia do workspace", () => {
  const workspaceId = "69f96665-ed67-4c94-b958-4da5ef3f533d";

  assert.equal(
    isWorkspaceMediaKey(
      `workspaces/${workspaceId}/media/2026/07/arquivo.jpg`,
      workspaceId,
    ),
    true,
  );
  assert.equal(
    isWorkspaceMediaKey(
      "workspaces/outro-workspace/media/2026/07/arquivo.jpg",
      workspaceId,
    ),
    false,
  );
  assert.equal(
    isWorkspaceMediaKey(
      `workspaces/${workspaceId}/media/../segredo.txt`,
      workspaceId,
    ),
    false,
  );
});

test("bloqueia upload que ultrapassa o limite seguro do workspace", () => {
  const result = validateWorkspaceUploadCapacity(
    WORKSPACE_MEDIA_LIMIT_BYTES - 10,
    11,
  );

  assert.equal(result.valid, false);
});

test("aceita upload dentro do limite seguro do workspace", () => {
  const result = validateWorkspaceUploadCapacity(
    WORKSPACE_MEDIA_LIMIT_BYTES - 10,
    10,
  );

  assert.equal(result.valid, true);
});
