import assert from "node:assert/strict";
import test from "node:test";

import { savePostDraftSchema, validateDraftMedia } from "./draft";

const image = {
  id: "00000000-0000-4000-8000-000000000001",
  clientId: "00000000-0000-4000-8000-000000000010",
  kind: "image" as const,
  mimeType: "image/jpeg",
};
const video = {
  id: "00000000-0000-4000-8000-000000000002",
  clientId: image.clientId,
  kind: "video" as const,
  mimeType: "video/mp4",
};

test("rejects duplicate media ids", () => {
  const result = savePostDraftSchema.safeParse({
    clientId: image.clientId,
    format: "carousel",
    caption: "",
    firstComment: "",
    mediaIds: [image.id, image.id],
  });
  assert.equal(result.success, false);
});

test("accepts an incomplete draft without media", () => {
  assert.equal(validateDraftMedia({ clientId: image.clientId, format: "image", mediaIds: [] }, []), null);
});

test("rejects video in an image post", () => {
  assert.match(
    validateDraftMedia({ clientId: image.clientId, format: "image", mediaIds: [video.id] }, [video]) ?? "",
    /somente arquivos de imagem/,
  );
});

test("rejects media assigned to another client", () => {
  assert.match(
    validateDraftMedia(
      { clientId: image.clientId, format: "carousel", mediaIds: [image.id] },
      [{ ...image, clientId: "00000000-0000-4000-8000-000000000099" }],
    ) ?? "",
    /cliente escolhido/,
  );
});

test("accepts MP4 for a Reel", () => {
  assert.equal(validateDraftMedia({ clientId: image.clientId, format: "reel", mediaIds: [video.id] }, [video]), null);
});
