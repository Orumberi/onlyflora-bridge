import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(stderr || `exit ${code}`)));
  });
}

test("onlytest preparation adds isolated modern UI loaders without changing the source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "onlyflora-theme-"));
  try {
    const input = join(dir, "index.html");
    const output = join(dir, "prepared.html");
    const source = "{strip}<html><body><main>Shop-Script</main></body></html>{/strip}";
    await writeFile(input, source);
    await runNode(["egor/prepare-onlytest.mjs", input, output, "https://bridge.example.com"]);
    const prepared = await readFile(output, "utf8");
    assert.equal(await readFile(input, "utf8"), source);
    assert.match(prepared, /\{if \$wa_theme_id == 'onlytest'\}/);
    assert.match(prepared, /id="onlyflora-onlytest-modern"/);
    assert.match(prepared, /https:\/\/bridge\.example\.com\/egor\/theme\.js/);
    assert.match(prepared, /id="onlyflora-egor-widget"/);
    assert.match(prepared, /https:\/\/bridge\.example\.com\/egor\/widget\.js/);
    assert.ok(prepared.indexOf("onlyflora-onlytest-modern") < prepared.indexOf("</body>"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("theme and widget both fail closed outside onlytest", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  const widget = await readFile("egor/public/widget.js", "utf8");
  for (const source of [theme, widget]) {
    assert.match(source, /\/themes\\\/onlytest\\\//);
    assert.match(source, /set_force_theme/);
    assert.match(source, /onlyTestResource/);
  }
});

test("modern navigation keeps every primary OnlyFlora section", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  for (const section of ["Озеленение", "Благоустройство", "Торговая площадка", "Озеленение ЖК", "Ландшафтный дизайн", "Уход и материалы", "Питомники", "Организация мероприятий"]) {
    assert.match(theme, new RegExp(`>${section}<`));
  }
  assert.match(theme, /nurseries: "\/market\/"/);
  assert.match(theme, /https:\/\/deksad\.ru\//);
  assert.match(theme, /event-organization\.png/);
});

test("modern header uses the approved OnlyFlora lockup", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  assert.match(theme, /Бедный не имеет тени/);
  assert.match(theme, /fill="#68c900"/);
  assert.match(theme, /fill="#071d13"/);
  assert.match(theme, /<circle cx="21\.2" cy="27\.5" r="3\.1" fill="#fff"/);
});

test("modern homepage runs on the Webasyst Site preview route", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  assert.match(theme, /new Set\(\["\/", "\/site"\]\)/);
  assert.match(theme, /homePaths\.has\(path\)/);
});

test("modern homepage uses Shop-Script search, fixed category assets and legal links", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  assert.match(theme, /const searchAction = "\/search\/"/);
  assert.match(theme, /name=\"\$\{escapeHtml\(searchName\)\}\"/);
  for (const asset of ["deciduous-trees.png", "conifers.png", "shrubs.png", "perennials.png", "ornamental-grasses.png"]) {
    assert.match(theme, new RegExp(asset.replace(".", "\\.")));
  }
  for (const page of ["personal-data-policy", "personal-data-consent", "cookie-policy", "advertising-consent"]) {
    assert.match(theme, new RegExp(`/site/legal/${page}/`));
  }
});

test("category assets can load cross-origin inside the Webasyst preview", async () => {
  const router = await readFile("egor/router.js", "utf8");
  assert.match(router, /_req\.path\.startsWith\("\/assets\/"\)/);
  assert.match(router, /Cross-Origin-Resource-Policy", "cross-origin"/);
});

test("modern navigation has a real accessible greenery dropdown", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  const css = await readFile("egor/public/theme.css", "utf8");
  assert.match(theme, /class="of-nav-greenery"/);
  assert.match(theme, /aria-controls="of-greenery-menu"/);
  assert.match(theme, /id="of-greenery-menu"/);
  assert.match(theme, /greeneryButton\.setAttribute\("aria-expanded"/);
  assert.match(css, /\.of-nav-dropdown/);
});

test("search corrects an obvious English keyboard layout typo", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  assert.match(theme, /function correctKeyboardLayout/);
  assert.match(theme, /const source = "qwertyuiop\[\]asdfghjkl;'zxcvbnm,\.`"/);
  assert.match(theme, /const target = "йцукенгшщзхъфывапролджэячсмитьбюё"/);
  assert.match(theme, /correctKeyboardLayout\(input\.value\.trim\(\)\)/);
});

test("onlytest product cards use the plant placeholder for missing or broken photos", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  const css = await readFile("egor/public/theme.css", "utf8");
  const fallbackSetup = theme.indexOf("data:image/jpeg;base64,");
  const homepageGuard = theme.indexOf("if (!homePaths.has(path)) return");
  assert.ok(fallbackSetup >= 0 && fallbackSetup < homepageGuard, "fallback must run on every Only Test catalog page");
  assert.match(theme, /document\.addEventListener\("error"/);
  assert.match(theme, /new MutationObserver/);
  assert.match(theme, /missingImagePattern/);
  assert.match(theme, /data-srcset/);
  assert.match(theme, /R0lGODlhAQABA/);
  assert.match(theme, /"\.product"/);
  assert.match(css, /\.of-product-image-fallback/);
});

test("cookie details opens the embedded policy instead of a missing page", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  assert.match(theme, /\.ofcb-details/);
  assert.match(theme, /event\?\.preventDefault\(\)/);
  assert.match(theme, /Политика использования файлов cookie/);
  assert.match(theme, /#of-cookie-policy/);
});
