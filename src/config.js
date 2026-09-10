function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, "");
}

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function webasystScope(value) {
  const apps = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set([...apps, "shop", "site"])].join(",");
}

const authSecret = required(
  "AUTH_SECRET",
  process.env.NODE_ENV === "production"
    ? undefined
    : "development-only-secret-change-before-deploying"
);

if (authSecret.length < 32) {
  throw new Error("AUTH_SECRET must contain at least 32 characters");
}

const configuredOrigins = process.env.OAUTH_ALLOWED_REDIRECT_ORIGINS
  ?.split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const config = Object.freeze({
  port: Number.parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  appBaseUrl: trimTrailingSlash(process.env.APP_BASE_URL),
  authSecret,
  webasyst: {
    accountUrl: trimTrailingSlash(
      required("WEBASYST_ACCOUNT_URL", "https://onlyflora.ru")
    ),
    clientId: required("WEBASYST_CLIENT_ID", "onlyflora-bridge"),
    clientName: required("WEBASYST_CLIENT_NAME", "OnlyFlora Bridge"),
    // Both apps are required by the bridge. Merge them with an explicitly
    // configured scope so an older WEBASYST_SCOPE=shop deployment upgrades
    // without a manual environment-variable edit.
    scope: webasystScope(required("WEBASYST_SCOPE", "shop,site")),
  },
  oauthAllowedRedirectOrigins: configuredOrigins || [
    "https://chatgpt.com",
    "https://chat.openai.com",
    "https://platform.openai.com",
  ],
});

export function publicBaseUrl(req) {
  if (config.appBaseUrl) return config.appBaseUrl;

  const proto = String(req.get("x-forwarded-proto") || req.protocol)
    .split(",")[0]
    .trim();
  const host = String(req.get("x-forwarded-host") || req.get("host"))
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}
