const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const crypto = require("node:crypto");
const path = require("node:path");
const app = express();
const port = Number(process.env.PORT || 3000);

app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const databaseUrl = process.env.DATABASE_URL || "";
let pool = null;
let dbReady = false;
let dbError = databaseUrl ? "Database is starting" : "DATABASE_URL is not configured";

const defaultContent = {
  heroTitle: "Создаём атмосферу, в которой хочется остаться",
  heroLead: "Флористика, декор и организация событий — как единая история, собранная вокруг вас.",
  introTitle: "Не просто оформление. Цельный образ события.",
  introText: "Мы соединяем флористику, пространство, свет, детали и ритм дня так, чтобы всё выглядело естественно — без визуального шума и случайных решений.",
  aboutTitle: "Эстетика начинается с внимания.",
  aboutText: "К месту, сезону, характеру пары или героя события. Мы начинаем с разговора и собираем решение вокруг вашей истории.",
  contactEmail: "hello@deksad.ru",
  contactPhone: "",
  telegram: "",
  city: "Москва"
};

async function initDb() {
  if (!databaseUrl) return;
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 5000,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_content (
        id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS media (
        id bigserial PRIMARY KEY,
        filename text NOT NULL,
        mime_type text NOT NULL,
        bytes bytea NOT NULL,
        size_bytes integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS projects (
        id bigserial PRIMARY KEY,
        title text NOT NULL,
        category text NOT NULL DEFAULT 'Событие',
        description text NOT NULL DEFAULT '',
        image_id bigint REFERENCES media(id) ON DELETE SET NULL,
        sort_order integer NOT NULL DEFAULT 100,
        published boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS providers (
        id bigserial PRIMARY KEY,
        name text NOT NULL,
        city text NOT NULL DEFAULT '',
        category text NOT NULL DEFAULT 'Организатор',
        description text NOT NULL DEFAULT '',
        phone text NOT NULL DEFAULT '',
        email text NOT NULL DEFAULT '',
        website text NOT NULL DEFAULT '',
        social text NOT NULL DEFAULT '',
        image_id bigint REFERENCES media(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
        featured boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO site_content(id, data)
      VALUES (1, $1::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `, [JSON.stringify(defaultContent)]);
    dbReady = true;
    dbError = null;
  } catch (err) {
    dbReady = false;
    dbError = err?.message || String(err);
    console.error("Database init failed:", dbError);
  }
}

function dbGuard(_req, res, next) {
  if (!dbReady) return res.status(503).json({ error: "database_unavailable", message: dbError });
  next();
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function adminSecret() {
  return process.env.ADMIN_SECRET || "";
}

function signToken(exp) {
  return crypto.createHmac("sha256", adminSecret()).update(String(exp)).digest("hex");
}

function issueToken() {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  return `${exp}.${signToken(exp)}`;
}

function validToken(token) {
  if (!token || !adminSecret()) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp || !sig) return false;
  return safeEqual(sig, signToken(exp));
}

function requireAdmin(req, res, next) {
  if (!validToken(cookies(req).deksad_admin)) return res.status(401).json({ error: "unauthorized" });
  next();
}

function cleanText(v, max = 5000) {
  return String(v ?? "").trim().slice(0, max);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, database: dbReady, databaseError: dbReady ? null : dbError });
});

app.get("/api/content", dbGuard, async (_req, res) => {
  const { rows } = await pool.query("SELECT data, updated_at FROM site_content WHERE id=1");
  res.json(rows[0] || { data: defaultContent });
});

app.get("/api/projects", dbGuard, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id,title,category,description,image_id AS \"imageId\",sort_order AS \"sortOrder\" FROM projects WHERE published=true ORDER BY sort_order,id DESC"
  );
  res.json(rows);
});

app.get("/api/providers", dbGuard, async (req, res) => {
  const q = cleanText(req.query.q, 100);
  const city = cleanText(req.query.city, 100);
  const category = cleanText(req.query.category, 100);
  const params = [];
  const where = ["status='published'"];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  if (city) {
    params.push(`%${city}%`);
    where.push(`city ILIKE $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`category=$${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT id,name,city,category,description,phone,email,website,social,image_id AS "imageId",featured
     FROM providers WHERE ${where.join(" AND ")}
     ORDER BY featured DESC,name ASC LIMIT 100`,
    params
  );
  res.json(rows);
});

app.post("/api/providers/submit", dbGuard, async (req, res) => {
  const name = cleanText(req.body.name, 160);
  const city = cleanText(req.body.city, 120);
  const category = cleanText(req.body.category, 80) || "Декоратор";
  const description = cleanText(req.body.description, 3000);
  const phone = cleanText(req.body.phone, 80);
  const email = cleanText(req.body.email, 160);
  const website = cleanText(req.body.website, 300);
  const social = cleanText(req.body.social, 300);
  if (!name || (!phone && !email && !social)) {
    return res.status(400).json({ error: "name_and_contact_required" });
  }
  const { rows } = await pool.query(
    `INSERT INTO providers(name,city,category,description,phone,email,website,social,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING id`,
    [name, city, category, description, phone, email, website, social]
  );
  res.status(201).json({ ok: true, id: rows[0].id });
});

app.get("/media/:id", dbGuard, async (req, res) => {
  const { rows } = await pool.query("SELECT mime_type,bytes FROM media WHERE id=$1", [req.params.id]);
  if (!rows[0]) return res.sendStatus(404);
  res.set("Content-Type", rows[0].mime_type);
  res.set("Cache-Control", "public,max-age=31536000,immutable");
  res.send(rows[0].bytes);
});

app.post("/api/admin/login", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD || "";
  const secret = adminSecret();
  if (!expected || !secret) return res.status(503).json({ error: "admin_not_configured" });
  if (!safeEqual(req.body.password || "", expected)) return res.status(401).json({ error: "wrong_password" });
  res.cookie("deksad_admin", issueToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ ok: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie("deksad_admin", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: validToken(cookies(req).deksad_admin), database: dbReady });
});

app.get("/api/admin/stats", requireAdmin, dbGuard, async (_req, res) => {
  const [p, providers, pending, media] = await Promise.all([
    pool.query("SELECT count(*)::int AS count FROM projects"),
    pool.query("SELECT count(*)::int AS count FROM providers WHERE status='published'"),
    pool.query("SELECT count(*)::int AS count FROM providers WHERE status='pending'"),
    pool.query("SELECT count(*)::int AS count FROM media"),
  ]);
  res.json({ projects: p.rows[0].count, providers: providers.rows[0].count, pending: pending.rows[0].count, media: media.rows[0].count });
});

app.put("/api/admin/content", requireAdmin, dbGuard, async (req, res) => {
  const current = { ...defaultContent, ...(req.body || {}) };
  const safe = {};
  for (const key of Object.keys(defaultContent)) safe[key] = cleanText(current[key], 6000);
  await pool.query("UPDATE site_content SET data=$1::jsonb,updated_at=now() WHERE id=1", [JSON.stringify(safe)]);
  res.json({ ok: true, data: safe });
});

app.post("/api/admin/media", requireAdmin, dbGuard, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "image_required" });
  const { rows } = await pool.query(
    "INSERT INTO media(filename,mime_type,bytes,size_bytes) VALUES($1,$2,$3,$4) RETURNING id,filename,mime_type,size_bytes,created_at",
    [cleanText(req.file.originalname, 250), req.file.mimetype, req.file.buffer, req.file.size]
  );
  res.status(201).json(rows[0]);
});

app.get("/api/admin/media", requireAdmin, dbGuard, async (_req, res) => {
  const { rows } = await pool.query("SELECT id,filename,mime_type,size_bytes,created_at FROM media ORDER BY id DESC LIMIT 200");
  res.json(rows);
});

app.delete("/api/admin/media/:id", requireAdmin, dbGuard, async (req, res) => {
  await pool.query("DELETE FROM media WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/admin/projects", requireAdmin, dbGuard, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id,title,category,description,image_id AS \"imageId\",sort_order AS \"sortOrder\",published,created_at AS \"createdAt\" FROM projects ORDER BY sort_order,id DESC"
  );
  res.json(rows);
});

app.post("/api/admin/projects", requireAdmin, dbGuard, async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO projects(title,category,description,image_id,sort_order,published)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [
      cleanText(req.body.title, 200),
      cleanText(req.body.category, 100) || "Событие",
      cleanText(req.body.description, 3000),
      req.body.imageId || null,
      Number(req.body.sortOrder || 100),
      req.body.published !== false,
    ]
  );
  res.status(201).json({ ok: true, id: rows[0].id });
});

app.put("/api/admin/projects/:id", requireAdmin, dbGuard, async (req, res) => {
  await pool.query(
    `UPDATE projects SET title=$1,category=$2,description=$3,image_id=$4,sort_order=$5,published=$6,updated_at=now() WHERE id=$7`,
    [
      cleanText(req.body.title, 200),
      cleanText(req.body.category, 100),
      cleanText(req.body.description, 3000),
      req.body.imageId || null,
      Number(req.body.sortOrder || 100),
      Boolean(req.body.published),
      req.params.id,
    ]
  );
  res.json({ ok: true });
});

app.delete("/api/admin/projects/:id", requireAdmin, dbGuard, async (req, res) => {
  await pool.query("DELETE FROM projects WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/admin/providers", requireAdmin, dbGuard, async (req, res) => {
  const status = cleanText(req.query.status, 30);
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE status=$1";
  }
  const { rows } = await pool.query(
    `SELECT id,name,city,category,description,phone,email,website,social,image_id AS "imageId",status,featured,created_at AS "createdAt"
     FROM providers ${where} ORDER BY created_at DESC`,
    params
  );
  res.json(rows);
});

app.post("/api/admin/providers", requireAdmin, dbGuard, async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO providers(name,city,category,description,phone,email,website,social,image_id,status,featured)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      cleanText(req.body.name,160), cleanText(req.body.city,120), cleanText(req.body.category,80),
      cleanText(req.body.description,3000), cleanText(req.body.phone,80), cleanText(req.body.email,160),
      cleanText(req.body.website,300), cleanText(req.body.social,300), req.body.imageId || null,
      ["pending","published","rejected"].includes(req.body.status) ? req.body.status : "published",
      Boolean(req.body.featured)
    ]
  );
  res.status(201).json({ ok:true,id:rows[0].id });
});

app.put("/api/admin/providers/:id", requireAdmin, dbGuard, async (req, res) => {
  const status = ["pending","published","rejected"].includes(req.body.status) ? req.body.status : "pending";
  await pool.query(
    `UPDATE providers SET name=$1,city=$2,category=$3,description=$4,phone=$5,email=$6,website=$7,social=$8,image_id=$9,status=$10,featured=$11,updated_at=now() WHERE id=$12`,
    [
      cleanText(req.body.name,160), cleanText(req.body.city,120), cleanText(req.body.category,80),
      cleanText(req.body.description,3000), cleanText(req.body.phone,80), cleanText(req.body.email,160),
      cleanText(req.body.website,300), cleanText(req.body.social,300), req.body.imageId || null,
      status, Boolean(req.body.featured), req.params.id
    ]
  );
  res.json({ ok:true });
});

app.delete("/api/admin/providers/:id", requireAdmin, dbGuard, async (req, res) => {
  await pool.query("DELETE FROM providers WHERE id=$1", [req.params.id]);
  res.json({ ok:true });
});

app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.get("/admin/", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.use(express.static(__dirname, { index: false, maxAge: "10m" }));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "file_too_large" });
  res.status(500).json({ error: "server_error", message: process.env.NODE_ENV === "production" ? undefined : err?.message });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`DekSad listening on 0.0.0.0:${port}`);
  initDb();
});
