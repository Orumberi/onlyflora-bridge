import assert from "node:assert/strict";
import test from "node:test";

import { OnlyFloraOAuthProvider } from "../src/oauth.js";

const issuerUrl = new URL("https://bridge.example.com");
const resourceUrl = new URL("https://bridge.example.com/mcp");

function clientRegistration() {
  return {
    client_id: "temporary-generated-id",
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret: "chatgpt-client-secret",
    client_secret_expires_at: 0,
    client_name: "ChatGPT",
    redirect_uris: ["https://chatgpt.com/connector/oauth/callback"],
    token_endpoint_auth_method: "client_secret_post",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  };
}

test("OAuth client registrations survive an application restart", async () => {
  const firstProvider = new OnlyFloraOAuthProvider({ issuerUrl, resourceUrl });
  const registered = await firstProvider.clientsStore.registerClient(clientRegistration());

  assert.notEqual(registered.client_id, "temporary-generated-id");

  const restartedProvider = new OnlyFloraOAuthProvider({ issuerUrl, resourceUrl });
  const restored = await restartedProvider.clientsStore.getClient(registered.client_id);

  assert.equal(restored.client_id, registered.client_id);
  assert.equal(restored.client_secret, "chatgpt-client-secret");
  assert.deepEqual(restored.redirect_uris, [
    "https://chatgpt.com/connector/oauth/callback",
  ]);
});

test("OAuth client store rejects invalid client identifiers", async () => {
  const provider = new OnlyFloraOAuthProvider({ issuerUrl, resourceUrl });
  assert.equal(await provider.clientsStore.getClient("not-a-client-token"), undefined);
});
