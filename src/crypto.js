import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { EncryptJWT, SignJWT, jwtDecrypt, jwtVerify } from "jose";

import { config } from "./config.js";

const secretKey = createHash("sha256").update(config.authSecret).digest();

export function randomId() {
  return randomUUID();
}

export async function signPayload(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(options.expiresIn || "10m")
    .setJti(options.jti || randomId())
    .sign(secretKey);
}

export async function verifySignedPayload(token) {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function encryptPayload(payload, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  let token = new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(options.expiresIn || "30d")
    .setJti(options.jti || randomId());

  if (options.issuer) token = token.setIssuer(options.issuer);
  if (options.audience) token = token.setAudience(options.audience);
  if (options.subject) token = token.setSubject(options.subject);

  return token.encrypt(secretKey);
}

export async function decryptPayload(token, options = {}) {
  const { payload } = await jwtDecrypt(token, secretKey, {
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: 5,
  });
  return payload;
}

export function sha256Base64Url(value) {
  return createHash("sha256").update(value).digest("base64url");
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
