// Public offer projection: never return purchase prices, contacts or internal params.
export function normalizeName(value = "") {
  const normalized = String(value).toLowerCase().replaceAll("ё", "е")
    .replace(/\([^)]*\)/g, " ")
    .replace(/thuja occidentalis/g, "туя западная")
    .replace(/cornus alba/g, "дерен белый")
    .replace(/smaragd/g, "смарагд").replace(/golden ring/g, "голден ринг")
    .replace(/blue\s*(?:and|&)\s*gold|блю\s+энд\s+голд/g, "blue gold")
    .replace(/береза\s+бородавчатая/g, "береза повислая")
    .replace(/можжевельник\s+пфитцериана/g, "можжевельник средний")
    .replace(/\b(?:на\s+штамбе|высота\s+растения)\b/g, " ")
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

export function girthRange(value = "") {
  const match = String(value).trim().replaceAll(",", ".").match(/^(\d+(?:\.\d+)?)(?:\s*[-–—]\s*(\d+(?:\.\d+)?))?\s*(?:см|cm)?$/i);
  if (!match) return null;
  const range = [Number(match[1]), Number(match[2] || match[1])];
  return range[0] > 0 && range[1] >= range[0] ? range : null;
}

function containerName(value) {
  const source = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (/ком.*(?:с|в)\s+(?:металлической\s+)?сетк(?:е|ой)/u.test(source)) return "WRB";
  if (/ком.*(?:без\s+сетки|в\s+мешковине)/u.test(source)) return "RB";
  if (/^(?:земляной\s+ком|ком(?:\s+земли)?)$/u.test(source)) return "RB/WRB";
  return source.toUpperCase().replaceAll("С", "C").replaceAll(",", ".").replace(/\s/g, "");
}

function containerMatches(wanted, offered) {
  const requested = containerName(wanted); const actual = containerName(offered);
  if (!requested) return true;
  if (requested === "RB/WRB") return /^(?:WRB|RB)(?:\d+(?:\.\d+)?)?$/.test(actual);
  if (requested === "WRB") return /^WRB(?:\d+(?:\.\d+)?)?$/.test(actual);
  if (requested === "RB") return /^RB(?:\d+(?:\.\d+)?)?$/.test(actual);
  const range = requested.match(/^([CP])(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (range) {
    const actualSize = actual.match(new RegExp(`^${range[1]}(\\d+(?:\\.\\d+)?)$`));
    return Boolean(actualSize && Number(actualSize[1]) >= Number(range[2]) && Number(actualSize[1]) <= Number(range[3]));
  }
  return actual === requested;
}

function rangesOverlap(wanted, offered) {
  if (!wanted || !offered) return true;
  if (wanted[0] === wanted[1]) return offered[0] <= wanted[0] && wanted[0] <= offered[1];
  if (offered[0] === offered[1]) return wanted[0] <= offered[0] && offered[0] <= wanted[1];
  return Math.max(wanted[0], offered[0]) < Math.min(wanted[1], offered[1]);
}

function alternativeScore(line, offer, productIds, wantedRange) {
  if (productIds.has(offer.productId)) return 1000;
  const wanted = normalizeName(line.name).split(" ").filter(Boolean);
  const actual = normalizeName(offer.name).split(" ").filter(Boolean);
  if (!wanted.length || wanted[0] !== actual[0]) return -1;
  const actualSet = new Set(actual);
  const shared = wanted.slice(1).filter(token => actualSet.has(token)).length;
  const rangeBonus = wantedRange && rangesOverlap(wantedRange, offer.range) ? 25 : 0;
  return 100 + shared * 30 + rangeBonus;
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
    const size = parts[0] || "";
    const girthMatch = size.match(/(?:обхват)(?:\s+ствола)?\s*(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:см|cm)?)(?=\s|[,;—–-]|$)/i);
    const height = size.replace(girthMatch?.[0] || "", "").replace(/[,;\-–—\s]+$/g, "").trim();
    const girth = girthMatch?.[1].trim() || "";
    const range = heightRange(height);
    const parsedGirthRange = girth ? girthRange(girth) : null;
    const container = containerName(parts[1]);
    const nursery = parts.slice(2).join(", ");
    const count = sku.count === null || sku.count === undefined ? null : Number(sku.count);
    const price = Number(sku.price);
    if (!sku.id || !range || (container && !/^(?:[CP]\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?|(?:WRB|RB)(?:\d+(?:\.\d+)?)?)$/.test(container)) || !nursery || !(price > 0) || !Number.isFinite(price) || !Number.isSafeInteger(Math.round(price * 100) * 100000)) return [];
    // Version 1 is for plants sold individually, not fractional units or packs.
    const minimum = Number(sku.order_count_min ?? product.order_count_min ?? 1);
    const step = Number(sku.order_count_step ?? product.order_count_step ?? 1);
    if (minimum !== 1 || step !== 1 || Number(product.order_multiplicity_factor ?? 1) !== 1
      || Number(product.count_denominator ?? 1) !== 1 || (count !== null && (!Number.isFinite(count) || count < 0))) return [];
    return [{
      productId: String(product.id), skuId: String(sku.id), sku: String(sku.sku || ""),
      name: product.name, height, range, girth, girthRange: parsedGirthRange, container, nursery,
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
      || normalizeName(previous.name) !== normalizeName(offer.name) || String(previous.range) !== String(offer.range)
      || String(previous.girthRange) !== String(offer.girthRange)) conflicts.add(key);
    else previous.count = previous.count === null || offer.count === null ? null : Math.min(previous.count, offer.count);
  }
  const allOffers = [...unique].filter(([key]) => !conflicts.has(key)).map(([, offer]) => offer);
  const remaining = new Map(allOffers.map(o => [o.skuId, o.count ?? 0]));
  const selectedNurseries = new Set();
  const rows = lines.map(line => {
    const matchingProducts = products.filter(p => nameMatches(line, p));
    const names = new Set(matchingProducts.map(p => normalizeName(p.name)));
    const wantedRange = line.height ? heightRange(line.height) : null;
    const wantedGirthRange = line.girth ? girthRange(line.girth) : null;
    const needsClarification = names.size > 1 || Boolean(line.height && !wantedRange) || Boolean(line.girth && !wantedGirthRange);
    const productIds = new Set(matchingProducts.map(p => String(p.id)));
    const fitting = allOffers.filter(o => productIds.has(o.productId)
      && containerMatches(line.container, o.container)
      && (!wantedRange || rangesOverlap(wantedRange, o.range))
      && (!wantedGirthRange || (o.girthRange && o.girthRange[0] === wantedGirthRange[0] && o.girthRange[1] === wantedGirthRange[1])));
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
    const seenAlternativeProducts = new Set();
    const alternatives = shortage ? allOffers
      .filter(o => !allocatedIds.has(o.skuId))
      .filter(o => o.count === null || o.count > 0)
      .map(o => ({ offer: o, score: alternativeScore(line, o, productIds, wantedRange) }))
      .filter(candidate => candidate.score >= 0)
      .sort((a, b) => b.score - a.score || a.offer.priceKopecks - b.offer.priceKopecks)
      .filter(({ offer }) => {
        if (seenAlternativeProducts.has(offer.productId)) return false;
        seenAlternativeProducts.add(offer.productId); return true;
      })
      .slice(0, 6).map(({ offer, score }) => ({ ...offer, reason: productIds.has(offer.productId)
        ? wantedGirthRange && !offer.girthRange ? "Обхват не указан — уточните у питомника"
          : "Тот же товар другого размера или контейнера"
        : score >= 130 ? "Близкий вариант того же рода — не точная замена"
          : "Аналог того же рода — проверьте сорт и характеристики" })) : [];
    return { request: line, allocations, shortage, alternatives,
      status: needsClarification ? "needs_clarification" : shortage ? (allocations.length ? "partial" : "not_found") : "matched" };
  });
  return { rows, checkedAt, searchComplete: complete, strategy,
    totalKopecks: rows.flatMap(r => r.allocations).reduce((sum, a) => sum + a.totalKopecks, 0),
    supplierCount: selectedNurseries.size,
    complete: complete && rows.every(r => r.shortage === 0),
    notes: ["Доставка не включена. Подбор не резервирует остатки.",
      ...(conflicts.size ? ["Обнаружены противоречивые дубли предложений; они исключены из автоматического подбора."] : []),
      "Обхват и контейнер в запросе необязательны. Если они указаны, подбор учитывает их. Неограниченный складской остаток требует подтверждения питомника.",
      ...(strategy === "suppliers" ? ["Число поставщиков сокращается эвристически; глобальный минимум не гарантируется."] : []),
      ...(!complete ? ["Проверена только часть результатов поиска; подбор не полный."] : [])] };
}
