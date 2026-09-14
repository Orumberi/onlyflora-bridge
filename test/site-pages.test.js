import test from "node:test";
import assert from "node:assert/strict";

import { buildSitePageFullUrl, normalizeSitePagePath } from "../src/mcp.js";

test("normalizeSitePagePath produces Webasyst page paths", () => {
  assert.equal(normalizeSitePagePath("/privacy"), "privacy/");
  assert.equal(normalizeSitePagePath("privacy/"), "privacy/");
  assert.equal(normalizeSitePagePath(" /privacy/ "), "privacy/");
});

test("buildSitePageFullUrl includes parent paths", () => {
  assert.equal(buildSitePageFullUrl("privacy"), "privacy/");
  assert.equal(buildSitePageFullUrl("/consent/", "/legal/"), "legal/consent/");
});
