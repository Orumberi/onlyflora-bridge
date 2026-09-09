const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function detectMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function safeFilename(filename, mimeType) {
  const fallback = `image.${MIME_EXTENSIONS[mimeType]}`;
  const basename = String(filename || fallback).split(/[\\/]/).pop();
  const cleaned = basename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 255);
  return cleaned || fallback;
}

export function decodeImageInput(imageBase64, { filename, mimeType } = {}) {
  let encoded = String(imageBase64 || "").trim();
  let declaredMime = mimeType;
  const dataUrl = encoded.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is);
  if (dataUrl) {
    declaredMime ||= dataUrl[1].toLowerCase();
    encoded = dataUrl[2];
  }

  encoded = encoded.replace(/\s+/g, "");
  if (!encoded || encoded.length > 7_100_000 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error("Image must be valid base64 data no larger than 5 MB");
  }

  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Image must be no larger than 5 MB");
  }

  const detectedMime = detectMimeType(buffer);
  if (!detectedMime) {
    throw new Error("Only JPEG, PNG, GIF, and WebP images are supported");
  }
  if (declaredMime && declaredMime.toLowerCase() !== detectedMime) {
    throw new Error(`Declared image type ${declaredMime} does not match ${detectedMime}`);
  }

  return {
    buffer,
    mimeType: detectedMime,
    filename: safeFilename(filename, detectedMime),
  };
}

