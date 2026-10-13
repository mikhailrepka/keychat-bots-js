import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyWebhook } from "../dist/index.js";

test("verifies signed webhook", () => {
  const body = JSON.stringify({ api_version: "1", id: "event", type: "endpoint.test", occurred_at: new Date().toISOString(), bot_id: "bot", data: {} });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", "secret").update(`${timestamp}.${body}`).digest("hex");
  assert.equal(verifyWebhook(body, { "X-KeyChat-Timestamp": timestamp, "X-KeyChat-Signature": `v1=${signature}` }, "secret").type, "endpoint.test");
});
