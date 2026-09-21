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
  for (const section of ["Озеленение", "Благоустройство", "Торговая площадка", "Озеленение ЖК", "Ландшафтный дизайн", "Уход и материалы"]) {
    assert.match(theme, new RegExp(`>${section}<`));
  }
});
