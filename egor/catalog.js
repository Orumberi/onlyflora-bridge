// Public offer projection: never return purchase prices, contacts or internal params.
export function normalizeName(value = "") {
  const normalized = String(value).toLowerCase().replaceAll("ё", "е")
    .replace(/thuja occidentalis/g, "туя западная")
    .replace(/cornus alba/g, "дерен белый")
    .replace(/smaragd/g, "смарагд").replace(/golden ring/g, "голден ринг")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  return normalized.split(" ").filter((token, i, all) => i === 0 || token !== all[i - 1]).join(" ");
}

export function heightRange(value = "") {
  const match = String(value).trim().replaceAll(",", ".").match(/^(\d+(?:\.\d+)?)(?:\s*[-–—]\s*(\d+(?:\.\d+)?))?\s*(см|cm|м|m)?$/i);
  if (!match) return null;
  const factor = /^(м|m)$/i.test(match[3] || "") ? 100 : 1;
  const range = [Number(match[1]) * factor, Number(match[2] || match[1]) * factor];
  return range[0] > 0 && range[1] >= range[0] ? range : null;
}

function containerName(value) {
  return String(value || "").toUpperCase().replaceAll("С", "C").replace(/\s/g, "");
}

export function publicOffers(product) {
  if (String(product.status) !== "1" || product.currency !== "RUB") return [];
  return Object.values(product.skus || {}).flatMap(sku => {
    if (String(sku.available) !== "1" || String(sku.status ?? 1) !== "1") return [];
    const modern = String(sku.name || "").includes(" · ");
    const rawParts = String(sku.name || "").split(modern ? " · " : ",").map(s => s.trim());
    const parts = modern ? [rawParts[1], rawParts[2], rawParts[0]] : rawParts;
    // The actual OnlyFlora master records encode the THREE variant fields here.
    // Product-level features are deliberately not used as variant fallbacks.
    const range = heightRange(parts[0]);
    const container = containerName(parts[1]);
    const nursery = parts.slice(2).join(", ");
    const count = sku.count === null || sku.count === undefined ? null : Number(sku.count);
    const price = Number(sku.price);
    if (!sku.id || !range || !/^(?:[CP]\d+(?:\.\d+)?|(?:WRB|RB)(?:\d+(?:\.\d+)?)?)$/.test(container) || !nursery || !(price > 0) || !Number.isFinite(price) || !Number.isSafeInteger(Math.round(price * 100) * 100000)) return [];
    // Version 1 is for plants sold individually, not fractional units or packs.
    const minimum = Number(sku.order_count_min ?? product.order_count_min ?? 1);
    const step = Number(sku.order_count_step ?? product.order_count_step ?? 1);
    if (minimum !== 1 || step !== 1 || Number(product.order_multiplicity_factor ?? 1) !== 1
      || Number(product.count_denominator ?? 1) !== 1 || (count !== null && (!Number.isFinite(count) || count < 0))) return [];
    return [{
      productId: String(product.id), skuId: String(sku.id), sku: String(sku.sku || ""),
      name: product.name, height: parts[0], range, container, nursery,
      priceKopecks: Math.round(price * 100), count: count === null ? null : Math.floor(count),
    }];
  });
}

export function nameMatches(request, product) {
  const wanted = normalizeName(request.name);
  const actual = normalizeName(product.name);
  if (wanted === actual) return true;
  // One explicit botanical synonym, not a fuzzy substring match: this must
  // never turn Smaragd into Golden Smaragd, a cone, a cube or a topiary.
  const optionalSpecies = name => name.startsWith("туя ") && name.split(" ").includes("смарагд")
    ? name.replace(/^туя западная /, "туя ") : name;
  return optionalSpecies(wanted) === optionalSpecies(actual);
}

export function buildPlan(lines, products, { strategy = "price", complete = true, checkedAt = new Date().toISOString() } = {}) {
  const projected = products.flatMap(publicOffers);
  const unique = new Map(); const conflicts = new Set();
  for (const offer of projected) {
    const key = offer.sku ? normalizeName(offer.nursery) + "|" + offer.sku : offer.skuId;
    const previous = unique.get(key);
    if (!previous) unique.set(key, offer);
    else if (previous.priceKopecks !== offer.priceKopecks || previous.container !== offer.container
      || normalizeName(previous.name) !== normalizeName(offer.name) || String(previous.range) !== String(offer.range)) conflicts.add(key);
    else previous.count = previous.count === null || offer.count === null ? null : Math.min(previous.count, offer.count);
  }
  const allOffers = [...unique].filter(([key]) => !conflicts.has(key)).map(([, offer]) => offer);
  const remaining = new Map(allOffers.map(o => [o.skuId, o.count ?? 0]));
  const selectedNurseries = new Set();
  const rows = lines.map(line => {
    const matchingProducts = products.filter(p => nameMatches(line, p));
    const names = new Set(matchingProducts.map(p => normalizeName(p.name)));
    const wantedRange = line.height ? heightRange(line.height) : null;
    const needsClarification = names.size > 1 || Boolean(line.height && !wantedRange);
    const productIds = new Set(matchingProducts.map(p => String(p.id)));
    const fitting = allOffers.filter(o => productIds.has(o.productId)
      && (!line.container || o.container === containerName(line.container))
      && (!wantedRange || (o.range[0] === wantedRange[0] && o.range[1] === wantedRange[1])));
    const candidates = fitting.filter(o => (remaining.get(o.skuId) || 0) > 0);
    const allocations = [];
    let shortage = line.quantity;
    if (!needsClarification) {
      candidates.sort((a, b) => {
        if (strategy === "suppliers") {
          const reused = Number(selectedNurseries.has(b.nursery)) - Number(selectedNurseries.has(a.nursery));
          if (reused) return reused;
          const full = Number((remaining.get(b.skuId) || 0) >= line.quantity) - Number((remaining.get(a.skuId) || 0) >= line.quantity);
          if (full) return full;
        }
        return a.priceKopecks - b.priceKopecks || a.skuId.localeCompare(b.skuId);
      });
      for (const offer of candidates) {
        const quantity = Math.min(shortage, remaining.get(offer.skuId));
        if (!quantity) continue;
        remaining.set(offer.skuId, remaining.get(offer.skuId) - quantity);
        selectedNurseries.add(offer.nursery);
        allocations.push({ ...offer, quantity, totalKopecks: quantity * offer.priceKopecks });
        shortage -= quantity;
        if (!shortage) break;
      }
    }
    const allocatedIds = new Set(allocations.map(o => o.skuId));
    const alternatives = shortage ? allOffers.filter(o => !allocatedIds.has(o.skuId)
      && (productIds.has(o.productId) || normalizeName(o.name).split(" ")[0] === normalizeName(line.name).split(" ")[0]))
      .slice(0, 8).map(o => ({ ...o, reason: o.count === null ? "Остаток не подтверждён" : "Проверьте название, сорт, размер и контейнер" })) : [];
    return { request: line, allocations, shortage, alternatives,
      status: needsClarification ? "needs_clarification" : shortage ? (allocations.length ? "partial" : "not_found") : "matched" };
  });
  return { rows, checkedAt, searchComplete: complete, strategy,
    totalKopecks: rows.flatMap(r => r.allocations).reduce((sum, a) => sum + a.totalKopecks, 0),
    supplierCount: selectedNurseries.size,
    complete: complete && rows.every(r => r.shortage === 0),
    notes: ["Доставка не включена. Подбор не резервирует остатки.",
      ...(conflicts.size ? ["Обнаружены противоречивые дубли предложений; они исключены из автоматического подбора."] : []),
      "Автоподбор использует предложения с однозначно указанными питомником, диапазоном высоты и контейнером. Неограниченный складской остаток требует подтверждения питомника.",
      ...(strategy === "suppliers" ? ["Число поставщиков сокращается эвристически; глобальный минимум не гарантируется."] : []),
      ...(!complete ? ["Проверена только часть результатов поиска; подбор не полный."] : [])] };
}
