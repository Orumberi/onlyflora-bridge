import { z } from "zod";
export const lineSchema = z.object({
  name: z.string().trim().min(2).max(160).regex(/^[\p{L}\p{N}\s'’"«»().,\/:+&№–—-]+$/u),
  quantity: z.number().int().min(1).max(100000),
  height: z.string().trim().max(40).default(""),
  girth: z.string().trim().max(30).default(""),
  container: z.string().trim().max(30).default(""),
});

export function stripListPrefix(value) {
  return String(value || "").replace(/^\s*(?:№\s*)?\d{1,3}\s*[.)\-:]\s*/u, "").trim();
}

const locationNames = new Set([
  "москва", "санкт петербург", "белгород", "воронеж", "курск", "липецк", "тамбов", "орел", "брянск",
  "калуга", "тула", "рязань", "владимир", "ярославль", "тверь", "смоленск", "кострома", "иваново",
  "нижний новгород", "казань", "самара", "саратов", "волгоград", "ростов на дону", "краснодар", "ставрополь",
  "сочи", "астрахань", "пенза", "ульяновск", "уфа", "пермь", "екатеринбург", "челябинск", "тюмень",
  "омск", "новосибирск", "томск", "кемерово", "красноярск", "иркутск", "хабаровск", "владивосток"
]);

export function isLocationLine(value) {
  const line = stripListPrefix(value).replace(/[.!,:;—–-]+$/u, "").trim();
  const normalized = line.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ");
  return /^(?:г(?:ород)?\.?\s+|регион\s+|насел[её]нный\s+пункт\s+)/i.test(line)
    || /\b(?:область|край|республика|район|округ)\b/i.test(line)
    || locationNames.has(normalized);
}
export const planSchema = z.object({
  lines: z.array(lineSchema).min(1).max(30),
  confirmed: z.literal(true),
  strategy: z.enum(["price", "suppliers"]).default("price"),
});
export const extractionSchema = z.object({
  lines: z.array(z.object({
    name: z.string().max(160), quantity: z.number().int().min(1).max(100000).nullable(),
    height: z.string().max(40), girth: z.string().max(30), container: z.string().max(30),
    uncertain: z.boolean(), note: z.string().max(400),
  })).max(30), warnings: z.array(z.string().max(400)).max(10),
});

export function isServiceLine(value) {
  const line = stripListPrefix(value);
  if (!line) return true;
  return /^(?:добрый\s+(?:день|вечер|утро)|здравствуйте|привет)(?=\s|[.!,:;—–-]|$)/i.test(line)
    || /^(?:спасибо|благодарю)(?=\s|[.!,:;—–-]|$)/i.test(line)
    || /^(?:запрос|список|заявка|требуется|нужно)[\s.!,:;—–-]*$/i.test(line)
    || /(?:^|\s)доставк[аи](?=\s|$)/i.test(line)
    || /^(?:условия\s+)?самовывоз(?=\s|$)/i.test(line)
    || /^(?:регион|адрес|телефон|контакты|почта|e-?mail|итого|всего)(?=\s|\s*:|$)/i.test(line);
}

export function normalizeContainer(value = "") {
  const source = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  if (/ком.*(?:с|в)\s+(?:металлической\s+)?сетк(?:е|ой)/u.test(source)) return "WRB";
  if (/ком.*(?:без\s+сетки|в\s+мешковине)/u.test(source)) return "RB";
  if (/^(?:земляной\s+ком|ком(?:\s+земли)?)$/u.test(source)) return "RB/WRB";
  const normalized = source.toUpperCase().replaceAll("С", "C").replaceAll(",", ".").replace(/\s+/g, "");
  return normalized;
}

function integerQuantity(value) {
  const number = Number(String(value).replace(",", "."));
  return Number.isInteger(number) && number > 0 && number <= 100000 ? number : null;
}

export function sanitizeExtraction(result) {
  const warnings = [...(result.warnings || [])];
  let skipped = 0;
  const lines = (result.lines || []).flatMap(line => {
    const name = stripListPrefix(line.name);
    if (!name || isServiceLine(name) || isLocationLine(name)) { skipped++; return []; }
    return [{ ...line, name }];
  });
  if (skipped) warnings.push("Пропущены служебные строки и населённые пункты: " + skipped + ".");
  return { lines, warnings: warnings.slice(0, 10) };
}

export function parseText(text) {
  const sourceLines = text.split(/\n|;/).map(stripListPrefix).filter(Boolean);
  const serviceLines = sourceLines.filter(line => isServiceLine(line) || isLocationLine(line));
  const plantLines = sourceLines.filter(line => !isServiceLine(line) && !isLocationLine(line));
  const warnings = [];
  if (serviceLines.length) warnings.push("Пропущены служебные строки: " + serviceLines.length + ".");
  if (plantLines.length > 30) warnings.push("Обработаны первые 30 строк. Остальные отправьте отдельно.");
  return { lines: plantLines.slice(0, 30).map(raw => {
    let name = raw;
    // An explicit trailing unit is the safest quantity marker. Extract it
    // before dimensions so decimals such as "2,5 м" and trunk girth never
    // become the requested number of plants.
    const explicitQty = name.match(/(?:^|\s)(?:[—–-]\s*)?(\d+)\s*(?:шт\.?|штук)\s*["”»)]*\s*$/i);
    const reversedQty = explicitQty ? null : name.match(/(?:^|\s)(?:шт\.?|штук)\s*(\d+(?:[.,]0+)?)\s*["”»)]*\s*$/i);
    const quantityMatch = explicitQty || reversedQty;
    let quantity = quantityMatch ? integerQuantity(quantityMatch[1]) : null;
    if (quantityMatch) name = name.slice(0, quantityMatch.index).trim();

    const container = name.match(/\b(?:WRB|RB)\s*\d*(?:[.,]\d+)?\b|\b(?:C|С|P)\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?\b|(?<!\p{L})(?:ком\s+(?:(?:с|в)\s+)?(?:металлической\s+)?сетк(?:е|ой)|ком\s+без\s+сетки|ком\s+в\s+мешковине|земляной\s+ком|ком\s+земли|ком)(?!\p{L})/iu);
    const explicitHeight = name.match(/(?:\bот\s+)?(\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?\s*)?(?:см|cm|м|m))(?=\s|[,;—–-]|$)/i);
    // Supplier tables often omit "см" between a root-ball code and "шт":
    // "WRB40 130-150 шт 27". A two-value range in this position is height.
    const bareHeight = !explicitHeight && container
      ? name.match(/\b(\d{2,4}\s*[-–—]\s*\d{2,4})(?=\s*$)/)
      : null;
    const girth = name.match(/(?:обхват)(?:\s+ствола)?\s*(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:см|cm)?)(?=\s|[,;—–-]|$)/i);
    const height = explicitHeight || bareHeight;
    const heightValue = explicitHeight ? explicitHeight[1].trim() : bareHeight ? `${bareHeight[1].trim()} см` : "";
    if (height) name = name.replace(height[0], " ");
    if (girth) name = name.replace(girth[0], " ");
    if (container) name = name.replace(container[0], " ");

    // Preserve the established shorthand "Название — 25" only after all
    // physical measurements have been removed. Supplier lists also commonly
    // omit "шт." after a dimension: "Клён 3–4 м 20".
    if (quantity === null) {
      const bareQty = name.match(/\s+[—–-]\s*(\d+)\s*$/);
      const dimensionQty = (height || girth || container) && name.match(/\s+(\d+)\s*$/);
      const match = bareQty || dimensionQty;
      if (match) { quantity = integerQuantity(match[1]); name = name.slice(0, match.index).trim(); }
    }
    return { name: name.replace(/(?:\s+от)?[,;\-–—\s"”»]+$/g, "").trim(), quantity,
      height: heightValue, girth: girth?.[1].trim() || "", container: normalizeContainer(container?.[0] || ""), uncertain: quantity === null,
      note: quantity === null ? "Укажите количество" : "" };
  }), warnings };
}
