import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNotificationEmail,
  notificationTargetView,
  sanitizeEmailError,
} from "./policy";

test("escapes notification content in transactional email HTML", () => {
  const result = buildNotificationEmail({
    title: "Falha <script>",
    body: "Cliente & post <img src=x>",
    appUrl: "https://voha.example.com/",
  });

  assert.match(result.html, /Falha &lt;script&gt;/u);
  assert.match(result.html, /Cliente &amp; post &lt;img src=x&gt;/u);
  assert.doesNotMatch(result.html, /<script>/u);
  assert.match(result.text, /Falha <script>/u);
});

test("stores only known email error codes and retry policy", () => {
  assert.deepEqual(sanitizeEmailError({
    code: "E_RATE_LIMIT_EXCEEDED",
    message: "token=secret",
  }), {
    code: "E_RATE_LIMIT_EXCEEDED",
    retryable: true,
  });
  assert.deepEqual(sanitizeEmailError(new Error("access_token=secret")), {
    code: "email_send_failed",
    retryable: false,
  });
});

test("routes connection alerts to clients and other alerts to calendar", () => {
  assert.equal(notificationTargetView({ view: "clients" }), "clients");
  assert.equal(notificationTargetView({ view: "calendar" }), "calendar");
  assert.equal(notificationTargetView({}), "calendar");
});
