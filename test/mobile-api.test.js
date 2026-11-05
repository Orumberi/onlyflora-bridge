import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createMobileApiRouter } from "../src/mobile-api.js";

let server;
let baseUrl;

const productHtml = `
  <script>
    window.product = { skus: {
      "12": {
        "id":"12","product_id":"34","sku":"A-12","available":true,"status":1,
        "count":6,"price":"1250.50",
        "features":{"nursery_sku1":"Садовый Лабиринт","plant_size_sku":"80–100 см · обхват 8–10 см","package_sku":"C5"}
      }
    }};
  </script>`;

before(async () => {
  const app = express();
  const fetchImpl = async (url) => {
    if (String(url).includes("/search/")) {
      return new Response('<article class="product-card">Спирея</article>', {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response(productHtml, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  app.use("/mobile/api", createMobileApiRouter({ fetchImpl }));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("catalog proxy returns HTML with app CORS", async () => {
  const response = await fetch(`${baseUrl}/mobile/api/catalog?query=спирея`, {
    headers: { origin: "https://app.onlyflora.ru" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://app.onlyflora.ru");
  assert.match(await response.text(), /Спирея/);
});

test("offers endpoint extracts nursery, dimensions, price and stock", async () => {
  const response = await fetch(`${baseUrl}/mobile/api/offers`, {
    method: "POST",
    headers: {
      origin: "https://app.onlyflora.ru",
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Клён", productUrl: "https://onlyflora.ru/klen/" }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.offers.length, 1);
  assert.deepEqual(data.offers[0], {
    productId: "34",
    skuId: "12",
    sku: "A-12",
    name: "Клён",
    productUrl: "https://onlyflora.ru/klen/",
    nursery: "Садовый Лабиринт",
    height: "80–100 см",
    girth: "8–10 см",
    container: "C5",
    priceKopecks: 125050,
    count: 6,
  });
});
