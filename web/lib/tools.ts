// Tool definitions handed to Gemini (via the OpenAI-compatible endpoint) plus
// the dispatcher that executes each call against the Odoo proxy. Read-only.
import { odoo } from "./odoo";

export const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_partners",
      description: "List customers (contacts) known to Odoo, with email/phone/city.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_products",
      description: "List sellable products with price and quantity on hand.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_sales_orders",
      description: "List recent sales orders with customer, total, and status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_invoices",
      description: "List posted customer invoices with amount and payment status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_bills",
      description: "List posted vendor bills with amount and payment status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_receivables",
      description: "List unpaid/partially-paid customer invoices (money owed TO the business).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payables",
      description: "List unpaid/partially-paid vendor bills (money the business OWES).",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function runTool(name: string, _args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "get_partners":
        return JSON.stringify(await odoo.partners());
      case "get_products":
        return JSON.stringify(await odoo.products());
      case "get_sales_orders":
        return JSON.stringify(await odoo.salesOrders());
      case "get_invoices":
        return JSON.stringify(await odoo.invoices());
      case "get_bills":
        return JSON.stringify(await odoo.bills());
      case "get_receivables":
        return JSON.stringify(await odoo.receivables());
      case "get_payables":
        return JSON.stringify(await odoo.payables());
      default:
        return JSON.stringify({ error: `unknown tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}
