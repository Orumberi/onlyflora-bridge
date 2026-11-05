import express from "express";
import { rateLimit } from "express-rate-limit";

const ONLYFLORA = "https://onlyflora.ru";
const APP_ORIGIN = "https://app.onlyflora.ru";

function setCors(req, res, next) {
  const origin = req.get("origin");
  if (origin === APP_ORIGIN) {
    res.set({
      "Access-Control-Allow-Origin": APP_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Cross-Origin-Resource-Policy": "cross-origin",
      Vary: "Origin",
    });
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

function balancedObject(source, marker) {
  const markerIndex = source.search(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf("{", markerIndex);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  return null;
}

function splitSize(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)\s*[·•]\s*обхват\s+(.+)$/i);
  return match
    ? { height: match[1].trim(), girth: match[2].trim() }
    : { height: text, girth: "" };
}

async function readProductOffers(fetchImpl, productUrl, name) {
  const source = new URL(String(productUrl || ""), ONLYFLORA);
  if (source.origin !== ONLYFLORA || !source.pathname || source.pathname === "/") {
    const error = new Error("Некорректная ссылка на товар.");
    error.status = 400;
    throw error;
  }
  const response = await fetchImpl(source, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Карточка товара временно недоступна.");
  const html = await response.text();
  const skuJson = balancedObject(html.slice(0, 2_500_000), /skus\s*:\s*\{/);
  if (!skuJson) throw new Error("В карточке товара не найдены предложения.");

  const skus = JSON.parse(skuJson);
  const offers = Object.values(skus)
    .filter((sku) => {
      const available = !(sku.available === false || sku.available === 0 || sku.available === "0");
      const active = !(sku.status === false || sku.status === 0 || sku.status === "0");
      const inStock = !(sku.count === 0 || sku.count === "0");
      return available && active && inStock;
    })
    .map((sku) => {
      const size = splitSize(sku.features?.plant_size_sku);
      const count = sku.count === null || typeof sku.count === "undefined"
        ? null
        : Math.max(0, Math.floor(Number(sku.count)));
      return {
        productId: String(sku.product_id || ""),
        skuId: String(sku.id || ""),
        sku: String(sku.sku || ""),
        name,
        productUrl: source.toString(),
        nursery: String(sku.features?.nursery_sku1 || "Питомник"),
        height: size.height,
        girth: size.girth,
        container: String(sku.features?.package_sku || ""),
        priceKopecks: Math.round(Number(sku.price || sku.primary_price || 0) * 100),
        count,
      };
    })
    .filter((offer) => offer.productId && offer.skuId && offer.priceKopecks > 0)
    .sort((left, right) => left.priceKopecks - right.priceKopecks || left.skuId.localeCompare(right.skuId));

  return {
    offers,
    checkedAt: new Date().toISOString(),
    searchComplete: true,
    source: "onlyflora-product-card",
  };
}

export function createMobileApiRouter({ fetchImpl = fetch } = {}) {
  const router = express.Router();
  router.use(setCors);
  router.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Слишком много запросов. Попробуйте через минуту." },
  }));

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "onlyflora-mobile-api" });
  });

  router.get("/catalog", async (req, res) => {
    const query = String(req.query.query || "").trim();
    if (query.length < 2 || query.length > 100) {
      res.status(400).json({ error: "Введите от 2 до 100 символов." });
      return;
    }
    try {
      const body = new URLSearchParams({ query });
      const endpoint = `${ONLYFLORA}/search/?query=${encodeURIComponent(query)}&ajax=1`;
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
          accept: "text/html",
        },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("upstream_catalog_error");
      res.set("Cache-Control", "no-store").type("html").send(await response.text());
    } catch {
      res.status(502).json({ error: "Каталог временно недоступен." });
    }
  });

  router.post("/offers", express.json({ limit: "256kb" }), async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (name.length < 2 || name.length > 160) {
      res.status(400).json({ error: "Некорректное название товара." });
      return;
    }
    try {
      res.set("Cache-Control", "no-store").json(
        await readProductOffers(fetchImpl, req.body?.productUrl, name)
      );
    } catch (error) {
      const status = error.name === "TimeoutError" ? 504 : error.status || 502;
      res.status(status).json({
        error: status === 504
          ? "Каталог отвечает слишком долго."
          : error.message || "Не удалось получить предложения товара.",
      });
    }
  });

  return router;
}
