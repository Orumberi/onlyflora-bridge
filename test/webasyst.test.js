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

test("WebasystClient blocks methods outside the explicit allowlist", async () => {
  const client = new WebasystClient({
    accessToken: "test-token",
    accountUrl: "https://example.webasyst.cloud",
    fetchImpl: async () => new Response("{}"),
  });

  await assert.rejects(() => client.call("site.theme.write"), /Blocked Webasyst method/);
});

test("WebasystClient lists Site pages with explicit compact flags", async () => {
  let captured;
  const client = new WebasystClient({
    accessToken: "test-token",
    accountUrl: "https://example.webasyst.cloud",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify([{ id: 12, name: "О компании" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.getSitePages(3, {
    includeContent: true,
    includeParams: true,
    tree: false,
  });

  assert.equal(result[0].id, 12);
  assert.match(captured.url, /api\.php\/site\.page\.getList/);
  assert.match(captured.url, /domain_id=3/);
  assert.match(captured.url, /content=1/);
  assert.match(captured.url, /params=1/);
  assert.match(captured.url, /tree=0/);
  assert.equal(captured.options.headers.Authorization, "Bearer test-token");
});

test("WebasystClient updates only supplied Site page fields", async () => {
  let captured;
  const client = new WebasystClient({
    accessToken: "test-token",
    accountUrl: "https://example.webasyst.cloud",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ id: 12, status: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.updateSitePage(12, {
    title: "Политика конфиденциальности — OnlyFlora",
    content: "<h1>Политика конфиденциальности</h1>",
    params: { description: "Правила обработки персональных данных" },
  });

  assert.equal(result.id, 12);
  assert.match(captured.url, /api\.php\/site\.page\.update/);
  assert.match(captured.url, /id=12/);
  assert.match(captured.options.body, /title=/);
  assert.match(captured.options.body, /content=/);
  assert.match(captured.options.body, /params%5Bdescription%5D=/);
  assert.equal(captured.options.headers.Authorization, "Bearer test-token");
});

test("WebasystClient uploads a product image as authenticated multipart data", async () => {
  let captured;
  const client = new WebasystClient({
    accessToken: "test-token",
    accountUrl: "https://example.webasyst.cloud",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ id: 77, product_id: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.uploadProductImage(
    42,
    {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      filename: "garden.png",
      mimeType: "image/png",
    },
    "Сад после благоустройства"
  );

  assert.equal(result.id, 77);
  assert.match(captured.url, /shop\.product\.images\.add/);
  assert.match(captured.url, /product_id=42/);
  assert.equal(captured.options.headers.Authorization, "Bearer test-token");
  assert.equal(captured.options.headers["Content-Type"], undefined);
  assert.ok(captured.options.body instanceof FormData);
  assert.equal(captured.options.body.get("product_id"), "42");
  assert.equal(captured.options.body.get("description"), "Сад после благоустройства");
  assert.equal(captured.options.body.get("file").name, "garden.png");
});
