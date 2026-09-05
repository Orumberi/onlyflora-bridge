import assert from "node:assert/strict";
import test from "node:test";

import { WebasystClient, toWebasystForm } from "../src/webasyst.js";

test("toWebasystForm serializes nested Webasyst arrays", () => {
  const form = toWebasystForm({
    name: "Геодезическая съёмка",
    categories: [10, 20],
    skus: [{ name: "Базовая цена", price: 1500, available: true }],
    params: { price_from: 1, onlyflora_kind: "service" },
  });

  assert.equal(form.get("name"), "Геодезическая съёмка");
  assert.equal(form.get("categories[0]"), "10");
  assert.equal(form.get("categories[1]"), "20");
  assert.equal(form.get("skus[0][name]"), "Базовая цена");
  assert.equal(form.get("skus[0][available]"), "1");
  assert.equal(form.get("params[price_from]"), "1");
});

test("WebasystClient sends access token in Authorization header", async () => {
  let captured;
  const client = new WebasystClient({
    accessToken: "test-token",
    accountUrl: "https://example.webasyst.cloud",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ id: 42, name: "Озеленение" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.createCategory({ name: "Озеленение", parent_id: 7 });

  assert.equal(result.id, 42);
  assert.match(captured.url, /api\.php\/shop\.category\.add/);
  assert.equal(captured.options.headers.Authorization, "Bearer test-token");
  assert.match(captured.options.body, /name=/);
  assert.match(captured.options.body, /parent_id=7/);
});

test("WebasystClient blocks methods outside the Shop-Script allowlist", async () => {
  const client = new WebasystClient({
    accessToken: "test-token",
    accountUrl: "https://example.webasyst.cloud",
    fetchImpl: async () => new Response("{}"),
  });

  await assert.rejects(() => client.call("site.theme.write"), /Blocked Webasyst method/);
});
