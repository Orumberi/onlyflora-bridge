import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { landscapingBlueprint } from "./blueprint.js";
import { WebasystClient } from "./webasyst.js";

const readSecurity = [{ type: "oauth2", scopes: ["catalog.read"] }];
const writeSecurity = [{ type: "oauth2", scopes: ["catalog.write"] }];

const commonText = z.string().max(200_000);
const slug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/i)
  .max(255);
const positiveId = z.coerce.number().int().positive();
const statusCategory = z.union([z.literal(0), z.literal(1)]);
const statusProduct = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const resultSchema = { result: z.unknown() };

function clientFromExtra(extra, requiredScope) {
  const auth = extra.authInfo;
  const token = auth?.extra?.webasystAccessToken;
  const accountUrl = auth?.extra?.webasystAccountUrl;
  if (!auth || !token || !auth.scopes.includes(requiredScope)) {
    throw new Error(`Authorization with scope ${requiredScope} is required`);
  }
  return new WebasystClient({ accessToken: String(token), accountUrl: String(accountUrl) });
}

function success(result, message) {
  return {
    structuredContent: { result },
    content: [{ type: "text", text: message }],
  };
}

function safeError(error) {
  const message = error?.description || error?.message || "Unknown Webasyst error";
  return {
    isError: true,
    content: [{ type: "text", text: `Webasyst operation failed: ${message}` }],
  };
}

function register(server, name, definition, handler) {
  server.registerTool(name, definition, async (input, extra) => {
    try {
      return await handler(input, extra);
    } catch (error) {
      return safeError(error);
    }
  });
}

export function createOnlyFloraMcpServer() {
  const server = new McpServer(
    { name: "onlyflora-webasyst", version: "0.1.0" },
    {
      instructions:
        "Inspect records before changing them. Use IDs returned by read tools. Never create duplicates. Writes affect the OnlyFlora Webasyst catalog; theme files are outside the standard API and are not exposed here.",
    }
  );

  register(
    server,
    "get_landscaping_blueprint",
    {
      title: "Get approved landscaping blueprint",
      description:
        "Return the approved Russian category/product plan for the Благоустройство section without changing Webasyst.",
      inputSchema: {},
      outputSchema: resultSchema,
      securitySchemes: readSecurity,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => success(landscapingBlueprint, "Returned the approved landscaping blueprint.")
  );

  register(
    server,
    "get_category_tree",
    {
      title: "Get Webasyst category tree",
      description: "Inspect the current Shop-Script category hierarchy before adding or moving categories.",
      inputSchema: {},
      outputSchema: resultSchema,
      securitySchemes: readSecurity,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (_input, extra) => {
      const result = await clientFromExtra(extra, "catalog.read").getCategoryTree();
      return success(result, "Loaded the current Webasyst category tree.");
    }
  );

  register(
    server,
    "search_products",
    {
      title: "Search Webasyst products",
      description:
        "Find products by a partial name or list products in one category before creating new records.",
      inputSchema: {
        query: z.string().min(1).max(200).optional(),
        category_id: positiveId.optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      },
      outputSchema: resultSchema,
      securitySchemes: readSecurity,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ query, category_id, limit, offset }, extra) => {
      if (!query && !category_id) throw new Error("Provide query or category_id");
      const result = await clientFromExtra(extra, "catalog.read").searchProducts({
        query,
        categoryId: category_id,
        limit,
        offset,
      });
      return success(result, "Loaded matching Webasyst products.");
    }
  );

  register(
    server,
    "get_product",
    {
      title: "Get Webasyst product",
      description: "Inspect one product, its SKUs, categories, images, and features by product ID.",
      inputSchema: { product_id: positiveId },
      outputSchema: resultSchema,
      securitySchemes: readSecurity,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ product_id }, extra) => {
      const result = await clientFromExtra(extra, "catalog.read").getProduct(product_id);
      return success(result, `Loaded product ${product_id}.`);
    }
  );

  register(
    server,
    "create_category",
    {
      title: "Create Webasyst category",
      description: "Create one static Shop-Script category under a verified parent category ID.",
      inputSchema: {
        name: z.string().min(1).max(255),
        parent_id: z.coerce.number().int().min(0).default(0),
        url: slug.optional(),
        description: commonText.optional(),
        meta_title: z.string().max(255).optional(),
        meta_description: z.string().max(1000).optional(),
        status: statusCategory.default(0),
        include_sub_categories: statusCategory.default(0),
      },
      outputSchema: resultSchema,
      securitySchemes: writeSecurity,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input, extra) => {
      const result = await clientFromExtra(extra, "catalog.write").createCategory(input);
      return success(result, `Created category “${input.name}”.`);
    }
  );

  register(
    server,
    "update_category",
    {
      title: "Update Webasyst category",
      description: "Update one existing category after inspecting its current state.",
      inputSchema: {
        category_id: positiveId,
        name: z.string().min(1).max(255).optional(),
        parent_id: z.coerce.number().int().min(0).optional(),
        url: slug.optional(),
        description: commonText.optional(),
        meta_title: z.string().max(255).optional(),
        meta_description: z.string().max(1000).optional(),
        status: statusCategory.optional(),
        include_sub_categories: statusCategory.optional(),
      },
      outputSchema: resultSchema,
      securitySchemes: writeSecurity,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ category_id, ...input }, extra) => {
      if (!Object.keys(input).length) throw new Error("No category fields were provided");
      const result = await clientFromExtra(extra, "catalog.write").updateCategory(
        category_id,
        input
      );
      return success(result, `Updated category ${category_id}.`);
    }
  );

  register(
    server,
    "create_product",
    {
      title: "Create Webasyst product or service card",
      description:
        "Create one Shop-Script product. For Благоустройство services set kind=service and price_from=true. Defaults to unpublished for safety.",
      inputSchema: {
        name: z.string().min(1).max(255),
        type_id: positiveId,
        category_ids: z.array(positiveId).min(1),
        price: z.coerce.number().min(0),
        currency: z.string().length(3).default("RUB"),
        summary: commonText.optional(),
        description: commonText.optional(),
        meta_title: z.string().max(255).optional(),
        meta_description: z.string().max(1000).optional(),
        url: slug.optional(),
        status: statusProduct.default(-1),
        sku_name: z.string().max(255).default("Базовая цена"),
        kind: z.enum(["service", "maf", "playground", "plant"]).optional(),
        price_from: z.boolean().default(false),
      },
      outputSchema: resultSchema,
      securitySchemes: writeSecurity,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ price, sku_name, category_ids, kind, price_from, ...input }, extra) => {
      const params = {
        ...(kind ? { onlyflora_kind: kind } : {}),
        ...(price_from ? { price_from: 1 } : {}),
      };
      const result = await clientFromExtra(extra, "catalog.write").createProduct({
        ...input,
        sku_type: 0,
        categories: category_ids,
        skus: [
          {
            name: sku_name,
            price,
            available: 1,
            status: 1,
          },
        ],
        ...(Object.keys(params).length ? { params } : {}),
      });
      return success(result, `Created product “${input.name}” as unpublished/selected status.`);
    }
  );

  register(
    server,
    "update_product",
    {
      title: "Update Webasyst product",
      description:
        "Update text, metadata, URL, price, or publication status of an inspected product. This overwrites supplied fields.",
      inputSchema: {
        product_id: positiveId,
        name: z.string().min(1).max(255).optional(),
        summary: commonText.optional(),
        description: commonText.optional(),
        meta_title: z.string().max(255).optional(),
        meta_description: z.string().max(1000).optional(),
        url: slug.optional(),
        status: z.union([z.literal(0), z.literal(1)]).optional(),
        price: z.coerce.number().min(0).optional(),
        price_from: z.boolean().optional(),
        kind: z.enum(["service", "maf", "playground", "plant"]).optional(),
      },
      outputSchema: resultSchema,
      securitySchemes: writeSecurity,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async ({ product_id, price_from, kind, ...input }, extra) => {
      if (price_from !== undefined || kind !== undefined) {
        input.params = {
          ...(kind !== undefined ? { onlyflora_kind: kind } : {}),
          ...(price_from !== undefined ? { price_from: price_from ? 1 : 0 } : {}),
        };
      }
      if (!Object.keys(input).length) throw new Error("No product fields were provided");
      const result = await clientFromExtra(extra, "catalog.write").updateProduct(
        product_id,
        input
      );
      return success(result, `Updated product ${product_id}.`);
    }
  );

  register(
    server,
    "add_product_to_category",
    {
      title: "Add product to Webasyst category",
      description: "Assign an existing product to one verified static category.",
      inputSchema: { product_id: positiveId, category_id: positiveId },
      outputSchema: resultSchema,
      securitySchemes: writeSecurity,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ product_id, category_id }, extra) => {
      const result = await clientFromExtra(extra, "catalog.write").addProductToCategory(
        product_id,
        category_id
      );
      return success(result, `Added product ${product_id} to category ${category_id}.`);
    }
  );

  register(
    server,
    "add_product_sku",
    {
      title: "Add Webasyst product SKU",
      description:
        "Add one purchasable variant to an inspected product. Use this for real variants; do not convert service-category headings into SKUs.",
      inputSchema: {
        product_id: positiveId,
        name: z.string().min(1).max(255),
        sku: z.string().max(255).optional(),
        price: z.coerce.number().min(0),
        compare_price: z.coerce.number().min(0).optional(),
        purchase_price: z.coerce.number().min(0).optional(),
        available: statusCategory.default(1),
        status: statusCategory.default(1),
        count: z.coerce.number().min(0).nullable().optional(),
      },
      outputSchema: resultSchema,
      securitySchemes: writeSecurity,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ product_id, ...input }, extra) => {
      const result = await clientFromExtra(extra, "catalog.write").addSku(product_id, input);
      return success(result, `Added a new SKU to product ${product_id}.`);
    }
  );

  return server;
}
