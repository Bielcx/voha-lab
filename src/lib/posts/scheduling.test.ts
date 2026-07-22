import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveScheduledFor,
  validatePostForPublication,
} from "./scheduling";

const connected = {
  accountConnected: true,
  tokenExpiresAt: "2026-08-20T12:00:00.000Z",
  now: new Date("2026-07-21T12:00:00.000Z"),
};

test("accepts a connected JPEG image post", () => {
  assert.equal(validatePostForPublication({
    ...connected,
    format: "image",
    media: [{ id: "media-1", kind: "image", mimeType: "image/jpeg" }],
  }), null);
});

test("requires two items in a carousel", () => {
  assert.match(validatePostForPublication({
    ...connected,
    format: "carousel",
    media: [{ id: "media-1", kind: "image", mimeType: "image/jpeg" }],
  }) ?? "", /entre 2 e 10/u);
});

test("rejects a token close to expiration", () => {
  assert.match(validatePostForPublication({
    ...connected,
    tokenExpiresAt: "2026-07-21T12:04:00.000Z",
    format: "reel",
    media: [{ id: "media-1", kind: "video", mimeType: "video/mp4" }],
  }) ?? "", /expirou/u);
});

test("requires a future time when scheduling", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");
  assert.equal(resolveScheduledFor({ mode: "schedule", scheduledFor: "2026-07-21T12:00:30.000Z" }, now), null);
  assert.equal(resolveScheduledFor({ mode: "schedule", scheduledFor: "2026-07-21T12:10:00.000Z" }, now), "2026-07-21T12:10:00.000Z");
});
