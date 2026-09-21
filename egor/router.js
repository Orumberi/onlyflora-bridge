import express from "express";
import { rateLimit } from "express-rate-limit";
import { timingSafeEqual, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { planSchema, parseText } from "./schema.js";
import { recognizePhoto } from "./vision.js";
import { buildPlan } from "./catalog.js";
import { EgorCatalog } from "./search.js";

export function createEgorRouter({ env = process.env, catalog, recognize = recognizePhoto } = {}) {
  const router = express.Router();
  const previewKey = env.EGOR_PREVIEW_KEY || "";
  const enabled = env.EGOR_ENABLED === "true";
  const catalogClient = catalog || new EgorCatalog({ accountUrl: env.WEBASYST_ACCOUNT_URL || "https://onlyflora.ru", token: env.EGOR_WEBASYST_TOKEN });
  const ready = enabled && previewKey.length >= 32 && Boolean(catalog || env.EGOR_WEBASYST_TOKEN);
  const photoReady = Boolean(env.EGOR_OPENAI_KEY && env.EGOR_OPENAI_MODEL);
  let busy = false;
  const publicDir = fileURLToPath(new URL("./public/", import.meta.url));
  router.use((_req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://onlyflora.ru https://onlyflora.webasyst.cloud; object-src 'none'; base-uri 'none'" });
    if (["/widget.js", "/theme.js", "/theme.css"].includes(_req.path)) {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*");
    }
    // The assistant is framed by Only Test; CSP restricts the permitted parents.
    res.removeHeader("X-Frame-Options"); next();
  });
  router.get("/status", (_req, res) => res.json({ ready, photoReady: ready && photoReady, preview: true }));
  router.use("/api", rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: "Слишком много запросов. Попробуйте через минуту." } }));
  router.use("/api", (req, res, next) => {
    if (!ready) return res.status(503).json({ error: "Тестовый помощник ещё не подключён к каталогу." });
    const supplied = String(req.headers.authorization || "").replace(/^Bearer /, "");
    const digest = s => createHash("sha256").update(s).digest();
    if (!timingSafeEqual(digest(supplied), digest(previewKey))) return res.status(401).json({ error: "Нужен код доступа к тестовой версии." });
    next();
  });
  router.use("/api", express.json({ limit: "8mb" }));
  router.use("/api", (req, res, next) => {
    if (busy) return res.status(429).json({ error: "Егор завершает другой подбор. Повторите чуть позже." });
    busy = true;
    // Release on completed work, not socket close: disconnect must not bypass the lock.
    res.locals.release = () => { busy = false; }; next();
  });
  router.post("/api/extract", async (req, res, next) => {
    try {
      if (req.body.image) {
        res.json(await recognize(req.body.image, { apiKey: env.EGOR_OPENAI_KEY, model: env.EGOR_OPENAI_MODEL }));
      } else {
        const text = req.body.text;
        if (typeof text !== "string" || !text.trim() || text.length > 10000) return res.status(400).json({ error: "Введите список до 10 000 символов." });
        res.json(parseText(text));
      }
    } catch (error) { next(error); }
    finally { res.locals.release(); }
  });
  router.post("/api/plan", async (req, res, next) => {
    try {
      const parsed = planSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Проверьте названия, положительные целые количества и подтвердите список (до 30 строк)." });
      const { lines, strategy } = parsed.data;
      const found = await catalogClient.find(lines);
      res.json(buildPlan(lines, found.products, { strategy, complete: found.complete, checkedAt: found.checkedAt }));
    } catch (error) { next(error); }
    finally { res.locals.release(); }
  });
  router.use("/api", (_req, res) => { res.locals.release?.(); res.status(404).json({ error: "Метод не найден." }); });
  router.use(express.static(publicDir, { index: "index.html", dotfiles: "deny" }));
  router.use((error, _req, res, _next) => {
    // Deliberately do not log user photos, lists, upstream errors or credentials.
    const status = error.type === "entity.too.large" ? 413 : error.status || 500;
    res.status(status).json({ error: status === 413 ? "Файл слишком большой." : error.type === "entity.parse.failed" ? "Некорректный запрос." : status === 500 ? "Не удалось выполнить подбор. Попробуйте ещё раз." : error.message });
  });
  return router;
}
