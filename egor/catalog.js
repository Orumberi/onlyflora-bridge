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
  return String(value || "").toUpperCase().replaceAll("С", "C").replace(/\s/g, "");
}


export function publicOffers(product) {
  if (String(product.status) !== "1" || product.currency !== "RUB") return [];
  return Object.values(product.skus || {}).flatMap(sku => {
    if (String(sku.available) !== "1" || String(sku.status ?? 1) !== "1") return [];
    const modern = String(sku.name || "").includes(" · ");
    const rawParts = String(sku.name || "").split(modern ? " · " : ",").map(s => s.trim());
    const parts = modern ? [rawParts[1], rawParts[2], rawParts[0]] : rawParts;
