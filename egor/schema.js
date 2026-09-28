import { z } from "zod";
export const lineSchema = z.object({
  name: z.string().trim().min(2).max(160).regex(/^[\p{L}\p{N}\s'’"«»().–—-]+$/u),
  quantity: z.number().int().min(1).max(100000),
  height: z.string().trim().max(40).default(""),
  container: z.string().trim().max(30).default(""),
});
export const planSchema = z.object({
  lines: z.array(lineSchema).min(1).max(30),
  confirmed: z.literal(true),
  strategy: z.enum(["price", "suppliers"]).default("price"),
});
export const extractionSchema = z.object({
  lines: z.array(z.object({
    name: z.string().max(160), quantity: z.number().int().min(1).max(100000).nullable(),
    height: z.string().max(40), container: z.string().max(30),
    uncertain: z.boolean(), note: z.string().max(400),
  })).max(30), warnings: z.array(z.string().max(400)).max(10),
});

export function parseText(text) {
  return { lines: text.split(/\n|;/).map(s => s.trim()).filter(Boolean).slice(0, 30).map(raw => {
    let name = raw;
    // An explicit trailing unit is the safest quantity marker. Extract it
    // before dimensions so decimals such as "2,5 м" and trunk girth never
    // become the requested number of plants.
    const explicitQty = name.match(/(?:^|\s)(?:[—–-]\s*)?(\d+)\s*(?:шт\.?|штук)\s*$/i);
    let quantity = explicitQty ? Number(explicitQty[1]) : null;
    if (explicitQty) name = name.slice(0, explicitQty.index).trim();

    const height = name.match(/\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?\s*)?(?:см|cm|м|m)(?=\s|[,;—–-]|$)/i);
    const container = name.match(/\b(?:WRB|RB|C|P)\s*\d+(?:[.,]\d+)?\b/i);
    if (height) name = name.replace(height[0], " ");
    if (container) name = name.replace(container[0], " ");

    // Girth is useful product detail, but the current catalogue matcher has
    // no separate girth field. Do not corrupt the plant name with it.
    name = name.replace(/[,\s]*(?:обхват)(?:\s+ствола)?\s*\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:см|cm)?\s*[-–—]?\s*$/i, " ");

    // Preserve the established shorthand "Название — 25" only after all
    // physical measurements have been removed.
    if (quantity === null) {
      const bareQty = name.match(/\s+[—–-]\s*(\d+)\s*$/);
      if (bareQty) { quantity = Number(bareQty[1]); name = name.slice(0, bareQty.index).trim(); }
    }
    return { name: name.replace(/[,;\-–—\s]+$/g, "").trim(), quantity,
      height: height?.[0].trim() || "", container: container?.[0] || "", uncertain: quantity === null,
      note: quantity === null ? "Укажите количество" : "" };
  }), warnings: text.split(/\n|;/).filter(s => s.trim()).length > 30 ? ["Обработаны первые 30 строк. Остальные отправьте отдельно."] : [] };
}
