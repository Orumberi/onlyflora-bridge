import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { buildPlan, heightRange, nameMatches, publicOffers } from "../catalog.js";
import { parseText } from "../schema.js";
import { recognizePhoto } from "../vision.js";
import { EgorCatalog } from "../search.js";
import { createEgorRouter } from "../router.js";

const product = JSON.parse(await readFile(new URL("fixtures/smaragd-2026-09-21.json", import.meta.url)));
const snapshot = JSON.parse(await readFile(new URL("fixtures/smaragd-search-2026-09-21.json", import.meta.url)));
const line = (quantity = 25, extra = {}) => ({ name: "Туя Смарагд", quantity, height: "60–80 см", container: "C3", ...extra });

test("real SKU 21264: 25 plants cost 31875 RUB, not the master card's other variant", () => {
  const result = buildPlan([line()], [product]);
  assert.equal(result.complete, true); assert.equal(result.totalKopecks, 3187500);
  assert.equal(result.rows[0].allocations[0].skuId, "21264");
  assert.equal(result.rows[0].allocations[0].nursery, "Садовый Лабиринт");
});
test("current multi-nursery records support nursery-first names and single heights", () => {
  const result = buildPlan([line(25, { height: "110 см", container: "WRB" })], snapshot);
  assert.equal(result.complete, true);
  assert.equal(result.rows[0].allocations[0].nursery, "Гарден Маркет");
  assert.equal(result.totalKopecks, 25 * 7650 * 100);
});
test("Smaragd does not become Golden Smaragd, a cone or a cube", () => {
  assert.equal(nameMatches(line(), snapshot.find(p => p.id === "26277")), false);
  assert.equal(nameMatches(line(), snapshot.find(p => p.id === "26269")), false);
  assert.equal(nameMatches(line(), snapshot.find(p => p.id === "26285")), true);
});
test("range conversion retains physical dimensions", () => {
  assert.deepEqual(heightRange("0,6–0,8 м"), [60,80]);
  assert.deepEqual(heightRange("110 см"), [110,110]);
});
test("wrong container is an alternative, never an allocation", () => {
  const result = buildPlan([line(25, { height: "80–100 см", container: "C5" })], [product]);
  assert.equal(result.rows[0].allocations.length, 0);
  assert.equal(result.rows[0].shortage, 25); assert.equal(result.totalKopecks, 0);
  assert.ok(result.rows[0].alternatives.length);
});
test("repeated rows cannot allocate the same stock twice", () => {
  const result = buildPlan([line(100), line(100)], [product]);
  assert.equal(result.rows[0].shortage, 0); assert.equal(result.rows[1].shortage, 54);
  assert.equal(result.totalKopecks, 146 * 1275 * 100);
});
test("duplicate supplier article in two products is not double stock", () => {
  const copy = structuredClone(product); copy.id = "duplicate";
  copy.skus = copy.skus.map(s => ({ ...s, id: "copy-" + s.id }));
  const result = buildPlan([line(200)], [product, copy]);
  assert.equal(result.rows[0].shortage, 54);
});
test("conflicting supplier duplicate is excluded, not silently cheaper", () => {
  const copy = structuredClone(product); copy.id = "duplicate";
  copy.skus = copy.skus.map(s => ({ ...s, id: "copy-" + s.id, price: s.price + 1 }));
  const result = buildPlan([line()], [product, copy]);
  assert.equal(result.rows[0].allocations.length, 0);
  assert.ok(result.notes.some(n => n.includes("дубли")));
});
test("split supply is possible and only uses available stock", () => {
  const copy = structuredClone(product); copy.id = "second";
  copy.skus = [{ ...copy.skus[0], id: "second-1", sku: "SECOND-1", name: "60–80 см, C3, Второй питомник", count: "10" }];
  const result = buildPlan([line(150)], [product, copy]);
  assert.equal(result.complete, true); assert.equal(result.supplierCount, 2);
  assert.equal(result.rows[0].allocations.reduce((sum, o) => sum + o.quantity, 0), 150);
});
test("unknown stock and unpublished products cannot fill an order", () => {
  const copy = structuredClone(product); copy.skus.forEach(s => s.count = null);
  assert.equal(buildPlan([line()], [copy]).rows[0].shortage, 25);
  copy.status = "0"; assert.equal(publicOffers(copy).length, 0);
});
test("null API stock is not invented; raw private fields are never projected", () => {
  const copy = structuredClone(product); copy.purchase_price = 10; copy.contact_id = "secret";
  copy.skus[0].purchase_price = 7;
  const output = JSON.stringify(buildPlan([line()], [copy]));
  assert.doesNotMatch(output, /purchase_price|contact_id|secret/);
});
test("text parser does not read the upper height as quantity", () => {
  const result = parseText("Туя Смарагд 60–80 см C3 — 25 шт.\nТуя Смарагд 80 – 100 см");
  assert.equal(result.lines[0].quantity, 25); assert.equal(result.lines[0].height, "60–80 см");
  assert.equal(result.lines[0].container, "C3"); assert.equal(result.lines[0].name, "Туя Смарагд");
  assert.equal(result.lines[1].quantity, null);
});
test("catalog pagination includes later offers and encodes an authenticated GET", async () => {
  const calls = [];
  const catalog = new EgorCatalog({ token: "test-catalog-token", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ count: 101, products: url.searchParams.get("offset") === "0"
      ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: "last" }] }));
  } });
  const result = await catalog.find([line()]);
  assert.equal(result.products.length, 101); assert.equal(result.complete, true);
  assert.equal(calls[1].url.searchParams.get("offset"), "100");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-catalog-token");
  assert.equal(calls[0].options.body, undefined);
});
test("truncated catalog cannot claim a complete search", async () => {
  const catalog = new EgorCatalog({ token: "test", fetchImpl: async () => new Response(JSON.stringify({ count: 1000, products: Array.from({ length: 100 }, (_, id) => ({ id })) })) });
  const result = await catalog.find([line()]); assert.equal(result.complete, false);
  assert.equal(buildPlan([line()], [product], { complete: false }).complete, false);
});
test("photo refuses incomplete response and does not expose raw provider data", async () => {
  const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nXcAAAAASUVORK5CYII=";
  let request;
  await assert.rejects(() => recognizePhoto(image, { apiKey: "private-key", model: "configured-model", fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body); return new Response(JSON.stringify({ status: "incomplete" }));
  } }), /не распознано полностью/);
  assert.equal(request.store, false); assert.equal(request.text.format.strict, true);
  assert.equal(request.input[0].content[1].image_url, image);
});
test("HTTP preview is closed by default and refuses unauthenticated catalog access", async t => {
  const app = express(); let calls = 0;
  const env = { EGOR_ENABLED: "true", EGOR_PREVIEW_KEY: "p".repeat(32) };
  app.use("/egor", createEgorRouter({ env, catalog: { find: async () => { calls++; return { products: [product], complete: true }; } } }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.on("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/egor`;
  const noAuth = await fetch(base + "/api/plan", { method: "POST" }); assert.equal(noAuth.status, 401); assert.equal(calls, 0);
  const response = await fetch(base + "/api/plan", { method: "POST", headers: { Authorization: "Bearer " + env.EGOR_PREVIEW_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ lines: [line()], confirmed: true }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).totalKopecks, 3187500); assert.equal(calls, 1);
  const page = await fetch(base + "/"); assert.equal(page.status, 200); assert.match(await page.text(), /Егор Григорьевич S/);
});
test("disabled preview cannot call upstream services", async t => {
  const app = express(); app.use("/egor", createEgorRouter({ env: {} }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.on("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/egor`;
  assert.equal((await (await fetch(base + "/status")).json()).ready, false);
  assert.equal((await fetch(base + "/api/extract", { method: "POST" })).status, 503);
});
