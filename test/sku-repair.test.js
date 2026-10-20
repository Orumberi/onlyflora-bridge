import assert from "node:assert/strict";
import test from "node:test";

import { selectPurchasableUnavailableSkus } from "../src/mcp.js";

test("SKU availability repair selects only priced, stocked, visible SKUs", () => {
  const products = [
    {
      id: "10",
      name: "Рябина",
      skus: {
        101: {
          id: "101",
          product_id: "10",
          name: "C2",
          price: "870.0000",
          count: "15.000",
          available: "0",
          status: "1",
        },
        102: { id: "102", price: "0", count: "5", available: "0", status: "1" },
        103: { id: "103", price: "500", count: "0", available: "0", status: "1" },
        104: { id: "104", price: "500", count: null, available: "0", status: "1" },
        105: { id: "105", price: "500", count: "5", available: "0", status: "0" },
        106: { id: "106", price: "500", count: "5", available: "1", status: "1" },
      },
    },
  ];

  assert.deepEqual(selectPurchasableUnavailableSkus(products), [
    {
      id: 101,
      product_id: 10,
      product_name: "Рябина",
      sku_name: "C2",
      price: 870,
      count: 15,
    },
  ]);
});
