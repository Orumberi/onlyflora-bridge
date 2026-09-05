import { randomUUID } from "node:crypto";

import {
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

import { config } from "./config.js";
import { decryptPayload, encryptPayload } from "./crypto.js";
import { exchangeWebasystCode } from "./webasyst.js";

const ACCESS_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

function parseCookie(req, name) {
  const cookies = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;
    if (cookie.slice(0, separator) === name) {
      return decodeURIComponent(cookie.slice(separator + 1));
    }
  }
  return undefined;
}

function assertAllowedRedirectUri(uri) {
  const parsed = new URL(uri);
  const isDevelopmentLoopback =
    config.nodeEnv !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  const allowedOrigin = config.oauthAllowedRedirectOrigins.includes(parsed.origin);

  if (parsed.protocol !== "https:" && !isDevelopmentLoopback) {
    throw new InvalidRequestError("redirect_uri must use HTTPS");
  }
  if (!allowedOrigin && !isDevelopmentLoopback) {
    throw new InvalidRequestError("redirect_uri origin is not allowed");
  }
}

class RegisteredClientsStore {
  constructor() {
    this.clients = new Map();
  }

  async getClient(clientId) {
    return this.clients.get(clientId);
  }

  async registerClient(client) {
    client.redirect_uris.forEach(assertAllowedRedirectUri);
    this.clients.set(client.client_id, client);
    return client;
  }
}

export class OnlyFloraOAuthProvider {
  constructor({ issuerUrl, resourceUrl }) {
    this.issuerUrl = issuerUrl;
    this.resourceUrl = resourceUrl;
    this.clientsStore = new RegisteredClientsStore();
    this.transactions = new Map();
    this.codes = new Map();
  }

  cleanup() {
    const now = Date.now();
    for (const [id, value] of this.transactions) {
      if (value.expiresAt < now) this.transactions.delete(id);
    }
    for (const [id, value] of this.codes) {
      if (value.expiresAt < now) this.codes.delete(id);
    }
  }

  validateResource(resource) {
    if (!resource) return;
    if (resource.href !== this.resourceUrl.href) {
      throw new InvalidRequestError("Invalid OAuth resource");
    }
  }

  async authorize(client, params, res) {
    this.cleanup();
    this.validateResource(params.resource);
    assertAllowedRedirectUri(params.redirectUri);

    const transactionId = randomUUID();
    this.transactions.set(transactionId, {
      client,
      params,
      expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
    });

    res.cookie("onlyflora_oauth_tx", transactionId, {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      maxAge: AUTHORIZATION_TTL_MS,
      path: "/oauth/webasyst/callback",
    });

    const callbackUri = new URL("/oauth/webasyst/callback", this.issuerUrl).href;
    const target = new URL(`${config.webasyst.accountUrl}/api.php/auth`);
    target.search = new URLSearchParams({
      client_id: config.webasyst.clientId,
      client_name: config.webasyst.clientName,
      response_type: "code",
      scope: config.webasyst.scope,
      redirect_uri: callbackUri,
      state: transactionId,
      format: "json",
    }).toString();

    res.redirect(302, target.href);
  }

  async completeWebasystAuthorization(req, res) {
    this.cleanup();
    const transactionId = String(
      req.query.state || parseCookie(req, "onlyflora_oauth_tx") || ""
    );
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      res.status(400).send("Authorization session expired. Start the connection again in ChatGPT.");
      return;
    }

    this.transactions.delete(transactionId);
    res.clearCookie("onlyflora_oauth_tx", { path: "/oauth/webasyst/callback" });

    const redirect = new URL(transaction.params.redirectUri);
    if (req.query.error) {
      redirect.searchParams.set("error", String(req.query.error));
      redirect.searchParams.set(
        "error_description",
        String(req.query.error_description || "Webasyst authorization was denied")
      );
      if (transaction.params.state) {
        redirect.searchParams.set("state", transaction.params.state);
      }
      res.redirect(302, redirect.href);
      return;
    }

    const webasystCode = String(req.query.code || "");
    if (!webasystCode) {
      res.status(400).send("Webasyst did not return an authorization code.");
      return;
    }

    const callbackUri = new URL("/oauth/webasyst/callback", this.issuerUrl).href;
    const { accessToken: webasystAccessToken } = await exchangeWebasystCode(
      webasystCode,
      callbackUri
    );

    const authorizationCode = randomUUID();
    this.codes.set(authorizationCode, {
      clientId: transaction.client.client_id,
      redirectUri: transaction.params.redirectUri,
      codeChallenge: transaction.params.codeChallenge,
      scopes: transaction.params.scopes || [],
      resource: transaction.params.resource || this.resourceUrl,
      webasystAccessToken,
      expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
    });

    redirect.searchParams.set("code", authorizationCode);
    if (transaction.params.state) {
      redirect.searchParams.set("state", transaction.params.state);
    }
    res.redirect(302, redirect.href);
  }

  async challengeForAuthorizationCode(client, authorizationCode) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData || codeData.expiresAt < Date.now()) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    if (codeData.clientId !== client.client_id) {
      throw new InvalidGrantError("Authorization code belongs to another client");
    }
    return codeData.codeChallenge;
  }

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri, resource) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData || codeData.expiresAt < Date.now()) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    if (codeData.clientId !== client.client_id) {
      throw new InvalidGrantError("Authorization code belongs to another client");
    }
    if (redirectUri && redirectUri !== codeData.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match");
    }
    if (resource && resource.href !== codeData.resource.href) {
      throw new InvalidGrantError("resource does not match");
    }

    this.codes.delete(authorizationCode);
    const scopes = codeData.scopes.filter((scope) =>
      ["catalog.read", "catalog.write"].includes(scope)
    );
    const effectiveScopes = scopes.length ? scopes : ["catalog.read", "catalog.write"];
    const accessToken = await encryptPayload(
      {
        clientId: client.client_id,
        scopes: effectiveScopes,
        resource: codeData.resource.href,
        webasystAccessToken: codeData.webasystAccessToken,
        webasystAccountUrl: config.webasyst.accountUrl,
      },
      {
        issuer: this.issuerUrl.href,
        audience: this.resourceUrl.href,
        subject: "onlyflora-webasyst-admin",
        expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`,
      }
    );

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: effectiveScopes.join(" "),
    };
  }

  async exchangeRefreshToken() {
    throw new InvalidGrantError("Refresh tokens are not issued; reconnect when the token expires");
  }

  async verifyAccessToken(token) {
    try {
      const payload = await decryptPayload(token, {
        issuer: this.issuerUrl.href,
        audience: this.resourceUrl.href,
      });
      if (!payload.webasystAccessToken || !payload.clientId || !payload.exp) {
        throw new Error("Missing access-token claims");
      }

      return {
        token,
        clientId: String(payload.clientId),
        scopes: Array.isArray(payload.scopes) ? payload.scopes.map(String) : [],
        expiresAt: Number(payload.exp),
        resource: this.resourceUrl,
        extra: {
          webasystAccessToken: String(payload.webasystAccessToken),
          webasystAccountUrl: String(payload.webasystAccountUrl || config.webasyst.accountUrl),
        },
      };
    } catch {
      throw new InvalidTokenError("Invalid or expired access token");
    }
  }
}
