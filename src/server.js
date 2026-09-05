import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";

import { config } from "./config.js";
import { createOnlyFloraMcpServer } from "./mcp.js";
import { OnlyFloraOAuthProvider } from "./oauth.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);
app.use(express.json({ limit: "1mb" }));

const baseUrl = new URL(config.appBaseUrl || `http://localhost:${config.port}`);
const resourceUrl = new URL("/mcp", baseUrl);
const oauthProvider = new OnlyFloraOAuthProvider({
  issuerUrl: baseUrl,
  resourceUrl,
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "onlyflora-bridge", version: "0.1.0" });
});

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    "OnlyFlora Bridge is running. Connect the MCP endpoint at /mcp."
  );
});

app.get("/oauth/webasyst/callback", async (req, res) => {
  try {
    await oauthProvider.completeWebasystAuthorization(req, res);
  } catch (error) {
    console.error("Webasyst OAuth callback failed", {
      name: error?.name,
      message: error?.message,
    });
    if (!res.headersSent) {
      res.status(500).type("text/plain").send(
        "Authorization failed. Return to ChatGPT and try connecting again."
      );
    }
  }
});

app.use(
  mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: baseUrl,
    resourceServerUrl: resourceUrl,
    serviceDocumentationUrl: new URL("/", baseUrl),
    resourceName: "OnlyFlora Webasyst catalog",
    scopesSupported: ["catalog.read", "catalog.write"],
    clientRegistrationOptions: {
      clientSecretExpirySeconds: 0,
      rateLimit: { windowMs: 60 * 60 * 1000, max: 20 },
    },
  })
);

const mcpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceUrl);
const mcpAuth = requireBearerAuth({
  verifier: oauthProvider,
  requiredScopes: [],
  resourceMetadataUrl,
});

app.post("/mcp", mcpLimiter, mcpAuth, async (req, res) => {
  const server = createOnlyFloraMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", {
      name: error?.name,
      message: error?.message,
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  }
});

app.all("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled request error", {
    name: error?.name,
    message: error?.message,
  });
  res.status(500).json({ error: "internal_server_error" });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`OnlyFlora Bridge listening on port ${config.port}`);
});
