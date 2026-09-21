import { normalizeName } from "./catalog.js";

// Deliberately only GET requests and an explicit public-field projection.
export class EgorCatalog {
  constructor({ accountUrl = "https://onlyflora.ru", token, fetchImpl = fetch }) {
    this.accountUrl = accountUrl.replace(/\/+$/, ""); this.token = token; this.fetch = fetchImpl;
    const url = new URL(this.accountUrl);
    if (url.protocol !== "https:") throw new Error("Webasyst requires HTTPS");
  }
  async get(method, query) {
    if (!this.token) throw Object.assign(new Error("Подключение к каталогу ещё не настроено."), { status: 503 });
    if (!["shop.product.search", "shop.product.getInfo"].includes(method)) throw new Error("Read method only");
    const url = new URL(`${this.accountUrl}/api.php/${method}`);
    for (const [key, value] of Object.entries({ ...query, format: "json" })) url.searchParams.set(key, value);
    const response = await this.fetch(url, { headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Object.assign(new Error("Каталог временно недоступен. Подбор не выполнен."), { status: 502 });
    const data = await response.json();
    if (data.error) throw Object.assign(new Error("Каталог не разрешил чтение. Подбор не выполнен."), { status: 502 });
    return data;
  }
  async find(lines) {
    const terms = [...new Set(lines.map(line => normalizeName(line.name).split(" ")[0]))];
    const products = new Map(); let complete = true, requests = 0;
    const deadline = Date.now() + 90000;
    // Bounded work per request; if truncated, the UI explicitly says so.
    outer: for (const term of terms) {
      for (let page = 0; page < 5; page++) {
        if (requests >= 12 || Date.now() >= deadline) { complete = false; break outer; }
        requests++;
        const data = await this.get("shop.product.search", { hash: `search/name*=${term}`, offset: page * 100, limit: 100, fields: "id,name,status,currency,skus,order_count_min,order_count_step,order_multiplicity_factor,count_denominator", escape: 0 });
        const batch = Object.values(data.products || {});
        for (const product of batch) products.set(String(product.id), product);
        if (batch.length < 100 || (Number.isFinite(Number(data.count)) && (page + 1) * 100 >= Number(data.count))) break;
        if (page === 4) complete = false;
      }
    }
    return { products: [...products.values()], complete, checkedAt: new Date().toISOString() };
  }
}
