import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("category pages replace false ProStore boilerplate with truthful OnlyFlora guidance", async () => {
  const theme = await readFile("egor/public/theme.js", "utf8");
  for (const text of [
    "Предложения питомников",
    "Подбор растений",
    "Доставка по согласованию",
    "В этой категории пока нет опубликованных предложений.",
  ]) assert.ok(theme.includes(text));
  assert.match(theme, /dataset\.ofCategoryEgor = "1"/);
  assert.match(theme, /new CustomEvent\("onlyflora:open-egor"\)/);
  assert.match(theme, /\.social-likes-head/);
  assert.match(theme, /box\.remove\(\)/);
});
