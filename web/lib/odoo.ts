// Server-side client for the local read-only Odoo proxy (reached via the
// tunnel in production). Never imported into client components — the token
// stays on the server.

const BASE = process.env.ODOO_PROXY_URL || "";
const TOKEN = process.env.ODOO_PROXY_TOKEN || "";

async function call(path: string): Promise<unknown> {
  if (!BASE || !TOKEN) throw new Error("Odoo proxy not configured");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      // Bypass ngrok's free-tier browser-warning interstitial for server calls.
      "ngrok-skip-browser-warning": "true",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Odoo proxy ${path} -> HTTP ${res.status}`);
  return res.json();
}

export const odoo = {
  partners: () => call("/partners"),
  products: () => call("/products"),
  salesOrders: () => call("/sales_orders"),
  invoices: () => call("/invoices"),
  bills: () => call("/bills"),
  receivables: () => call("/receivables"),
  payables: () => call("/payables"),
};
