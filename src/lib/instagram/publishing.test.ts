import assert from "node:assert/strict";
import test from "node:test";

import {
  canRetryPublicationAutomatically,
  publicMetaErrorMessage,
  sanitizeMetaError,
} from "./publishing-policy";

test("stores only a safe subset of Meta errors", () => {
  const result = sanitizeMetaError(400, {
    error: {
      message: "request contained access_token=secret",
      type: "OAuthException",
      code: 190,
      error_subcode: 463,
      fbtrace_id: "trace-1",
    },
  });

  assert.deepEqual(result, {
    httpStatus: 400,
    code: 190,
    subcode: 463,
    type: "OAuthException",
    traceId: "trace-1",
    retryable: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /secret/u);
  assert.match(publicMetaErrorMessage(result), /Reconecte/u);
});

test("classifies transient Meta failures for retry", () => {
  assert.equal(sanitizeMetaError(503, null).retryable, true);
  assert.equal(sanitizeMetaError(400, { error: { is_transient: true } }).retryable, true);
});

test("never retries automatically after media_publish was dispatched", () => {
  assert.equal(canRetryPublicationAutomatically(true, false), true);
  assert.equal(canRetryPublicationAutomatically(true, true), false);
  assert.equal(canRetryPublicationAutomatically(false, false), false);
});
