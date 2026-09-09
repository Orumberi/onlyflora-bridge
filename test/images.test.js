import assert from "node:assert/strict";
import test from "node:test";

import { decodeImageInput } from "../src/images.js";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("decodeImageInput accepts a valid PNG data URL", () => {
  const result = decodeImageInput(`data:image/png;base64,${onePixelPng}`, {
    filename: "category image.png",
  });

  assert.equal(result.mimeType, "image/png");
  assert.equal(result.filename, "category-image.png");
  assert.ok(result.buffer.length > 8);
});

test("decodeImageInput rejects a mismatched declared type", () => {
  assert.throws(
    () => decodeImageInput(onePixelPng, { mimeType: "image/jpeg" }),
    /does not match image\/png/
  );
});

test("decodeImageInput rejects non-image base64", () => {
  assert.throws(() => decodeImageInput(Buffer.from("not an image").toString("base64")), /Only JPEG/);
});
