import { config } from "./config.js";

const DEFAULT_TIMEOUT_MS = 20_000;

const ALLOWED_METHODS = new Set([
  "shop.category.getTree",
  "shop.category.getInfo",
  "shop.product.getInfo",
  "shop.product.search",
  "shop.category.add",
  "shop.category.update",
  "shop.product.add",
  "shop.product.update",
  "shop.product.addToCategory",
  "shop.product.skus.add",
  "shop.product.images.add",
  "site.domain.getList",
  "site.page.getList",
  "site.page.getInfo",
  "site.page.add",
  "site.page.update",
]);

function assertAllowedMethod(method) {
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`Blocked Webasyst method: ${method}`);
  }
}

function appendFormValue(form, key, value) {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormValue(form, `${key}[${index}]`, item);
    });
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendFormValue(form, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  if (typeof value === "boolean") {
    form.append(key, value ? "1" : "0");
    return;
  }

  form.append(key, String(value));
}

export function toWebasystForm(values = {}) {
  const form = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    appendFormValue(form, key, value);
  });
  return form;
}

export class WebasystApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "WebasystApiError";
    this.status = details.status;
    this.code = details.code;
    this.description = details.description;
  }
}

export class WebasystClient {
  constructor({ accessToken, accountUrl = config.webasyst.accountUrl, fetchImpl = fetch }) {
    if (!accessToken) throw new Error("Webasyst access token is required");
    this.accessToken = accessToken;
    this.accountUrl = accountUrl.replace(/\/+$/, "");
    this.fetch = fetchImpl;
  }

  async call(method, { httpMethod = "GET", query = {}, body = {} } = {}) {
    assertAllowedMethod(method);

    const url = new URL(`${this.accountUrl}/api.php/${method}`);
    Object.entries({ ...query, format: "json" }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await this.fetch(url, {
        method: httpMethod,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
          ...(httpMethod === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: httpMethod === "POST" ? toWebasystForm(body).toString() : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new WebasystApiError("Webasyst returned a non-JSON response", {
          status: response.status,
        });
      }

      if (!response.ok || data?.error) {
        throw new WebasystApiError(
          data?.error_description || data?.error || `Webasyst HTTP ${response.status}`,
          {
            status: response.status,
            code: data?.error,
            description: data?.error_description,
          }
        );
      }

      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new WebasystApiError("Webasyst request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async callMultipart(method, { query = {}, fields = {}, file } = {}) {
    assertAllowedMethod(method);
    if (method !== "shop.product.images.add") {
      throw new Error(`Blocked multipart Webasyst method: ${method}`);
    }
    if (!file?.buffer || !file?.filename || !file?.mimeType) {
      throw new Error("A validated image file is required");
    }

    const url = new URL(`${this.accountUrl}/api.php/${method}`);
    Object.entries({ ...query, format: "json" }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => appendFormValue(form, key, value));
    form.append("file", new Blob([file.buffer], { type: file.mimeType }), file.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
        },
        body: form,
        signal: controller.signal,
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new WebasystApiError("Webasyst returned a non-JSON response", {
          status: response.status,
        });
      }

      if (!response.ok || data?.error) {
        throw new WebasystApiError(
          data?.error_description || data?.error || `Webasyst HTTP ${response.status}`,
          {
            status: response.status,
            code: data?.error,
            description: data?.error_description,
          }
        );
      }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new WebasystApiError("Webasyst request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async callCategoryThumbUpload(categoryId, file) {
    if (!file?.buffer || !file?.filename || !file?.mimeType) {
      throw new Error("A validated image file is required");
    }

    const url = new URL(`${this.accountUrl}/webasyst/shop/`);
    url.searchParams.set("module", "prodCategoryThumb");
    url.searchParams.set("action", "upload");

    const form = new FormData();
    form.append("category_id", String(categoryId));
    form.append("file", new Blob([file.buffer], { type: file.mimeType }), file.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: form,
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        throw new WebasystApiError(
          "Shop-Script rejected category thumbnail upload authorization",
          { status: response.status }
        );
      }

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new WebasystApiError(
          "Shop-Script category thumbnail endpoint returned a non-JSON response",
          { status: response.status }
        );
      }

      const actionErrors = Array.isArray(data?.errors)
        ? data.errors
            .map((error) => error?.text || error?.message || error?.id)
            .filter(Boolean)
            .join("; ")
        : "";
      if (!response.ok || data?.status === "fail" || data?.error || actionErrors) {
        throw new WebasystApiError(
          actionErrors ||
            data?.error_description ||
            data?.error ||
            `Webasyst HTTP ${response.status}`,
          {
            status: response.status,
            code: data?.error,
            description: actionErrors || data?.error_description,
          }
        );
      }

      return data?.data ?? data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new WebasystApiError("Webasyst request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  getCategoryTree() {
    return this.call("shop.category.getTree");
  }

  getCategory(id) {
    return this.call("shop.category.getInfo", { query: { id } });
  }

  getProduct(id) {
    return this.call("shop.product.getInfo", { query: { id } });
  }

  searchProducts({ query, categoryId, limit = 100, offset = 0 } = {}) {
    let hash;
    if (categoryId !== undefined) {
      hash = `category/${categoryId}`;
    } else if (query) {
      hash = `search/name*=${query}`;
    }

    return this.call("shop.product.search", {
      query: {
        hash,
        limit,
        offset,
        fields: "*,skus,params,frontend_url",
        escape: 0,
      },
    });
  }

  createCategory(input) {
    return this.call("shop.category.add", { httpMethod: "POST", body: input });
  }

  updateCategory(id, input) {
    return this.call("shop.category.update", {
      httpMethod: "POST",
      query: { id },
      body: input,
    });
  }

  createProduct(input) {
    return this.call("shop.product.add", { httpMethod: "POST", body: input });
  }

  updateProduct(id, input) {
    return this.call("shop.product.update", {
      httpMethod: "POST",
      query: { id },
      body: input,
    });
  }

  addProductToCategory(productId, categoryId) {
    return this.call("shop.product.addToCategory", {
      httpMethod: "POST",
      query: { id: productId },
      body: { category_id: categoryId },
    });
  }

  addSku(productId, input) {
    return this.call("shop.product.skus.add", {
      httpMethod: "POST",
      query: { product_id: productId },
      body: input,
    });
  }

  uploadProductImage(productId, file, description) {
    return this.callMultipart("shop.product.images.add", {
      query: { product_id: productId },
      fields: {
        product_id: productId,
        description,
      },
      file,
    });
  }

  async uploadCategoryImage(categoryId, file) {
    await this.getCategory(categoryId);
    return this.callCategoryThumbUpload(categoryId, file);
  }

  getSiteDomains() {
    return this.call("site.domain.getList");
  }

  getSitePages(
    domainId,
    { route, includeContent = false, includeParams = true, tree = true } = {}
  ) {
    return this.call("site.page.getList", {
      query: {
        domain_id: domainId,
        route,
        content: includeContent ? 1 : 0,
        params: includeParams ? 1 : 0,
        tree: tree ? 1 : 0,
      },
    });
  }

  getSitePage(id) {
    return this.call("site.page.getInfo", { query: { id } });
  }

  createSitePage(input) {
    return this.call("site.page.add", { httpMethod: "POST", body: input });
  }

  updateSitePage(id, input) {
    return this.call("site.page.update", {
      httpMethod: "POST",
      query: { id },
      body: input,
    });
  }
}

export async function exchangeWebasystCode(code, redirectUri) {
  const url = new URL(`${config.webasyst.accountUrl}/api.php/token`);
  const body = new URLSearchParams({
    code,
    client_id: config.webasyst.clientId,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => ({}));
  const accessToken = data.access_token || data.token;
  if (!response.ok || !accessToken) {
    throw new WebasystApiError(
      data.error_description || data.error || "Webasyst authorization failed",
      { status: response.status, code: data.error }
    );
  }

  return { accessToken, raw: data };
}
