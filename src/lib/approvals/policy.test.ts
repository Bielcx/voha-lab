import assert from "node:assert/strict";
import test from "node:test";

import {
  createApprovalToken,
  getApprovalAvailability,
  hashApprovalToken,
  isApprovalToken,
  requestApprovalSchema,
  respondApprovalSchema,
} from "./policy";

test("creates opaque 256-bit base64url approval tokens", async () => {
  const first = createApprovalToken();
  const second = createApprovalToken();

  assert.equal(first.length, 43);
  assert.equal(isApprovalToken(first), true);
  assert.notEqual(first, second);
  assert.match(await hashApprovalToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(await hashApprovalToken(first), await hashApprovalToken(second));
});

test("validates approval requests and applies safe defaults", () => {
  const parsed = requestApprovalSchema.parse({});
  assert.deepEqual(parsed, {
    approverName: "",
    approverEmail: "",
    expiresInDays: 7,
  });
  assert.equal(requestApprovalSchema.safeParse({ expiresInDays: 31 }).success, false);
  assert.equal(requestApprovalSchema.safeParse({ approverEmail: "invalid" }).success, false);
});

test("requires a reason when changes are requested", () => {
  assert.equal(respondApprovalSchema.safeParse({ decision: "approved" }).success, true);
  assert.equal(respondApprovalSchema.safeParse({ decision: "changes_requested", comment: "" }).success, false);
  assert.equal(respondApprovalSchema.safeParse({ decision: "changes_requested", comment: "Trocar a chamada." }).success, true);
});

test("derives terminal, expired and revoked link states", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");
  assert.equal(getApprovalAvailability({ status: "pending", expiresAt: "2026-07-24T12:00:00.000Z", revokedAt: null, now }), "pending");
  assert.equal(getApprovalAvailability({ status: "pending", expiresAt: "2026-07-22T12:00:00.000Z", revokedAt: null, now }), "expired");
  assert.equal(getApprovalAvailability({ status: "approved", expiresAt: "2026-07-24T12:00:00.000Z", revokedAt: null, now }), "approved");
  assert.equal(getApprovalAvailability({ status: "pending", expiresAt: "2026-07-24T12:00:00.000Z", revokedAt: "2026-07-23T11:00:00.000Z", now }), "revoked");
});
