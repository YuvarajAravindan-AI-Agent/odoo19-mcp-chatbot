"""
Thin, READ-ONLY client for the local Odoo instance (localhost:8069) over XML-RPC.

Design rules (security):
- Only ever calls `search_read`, never `create`/`write`/`unlink`/`execute_kw`
  with arbitrary methods. Every query the proxy can trigger is a fixed
  function defined here — the HTTP layer (main.py) does not accept arbitrary
  domains/fields from callers.
"""
import os
import xmlrpc.client

ODOO_URL = os.getenv("ODOO_URL", "http://localhost:8069")
ODOO_DB = os.getenv("ODOO_DB", "chatbot_db")
ODOO_USER = os.getenv("ODOO_USER", "admin")
ODOO_PASSWORD = os.getenv("ODOO_PASSWORD", "admin")

_common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
_models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")

_uid_cache: int | None = None


def _uid() -> int:
    global _uid_cache
    if _uid_cache is None:
        _uid_cache = _common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASSWORD, {})
        if not _uid_cache:
            raise RuntimeError("Odoo authentication failed")
    return _uid_cache


def _search_read(model: str, domain: list, fields: list[str], limit: int = 50, order: str = "") -> list[dict]:
    kwargs = {"fields": fields, "limit": limit}
    if order:
        kwargs["order"] = order
    return _models.execute_kw(
        ODOO_DB, _uid(), ODOO_PASSWORD, model, "search_read", [domain], kwargs
    )


def ping() -> tuple[bool, str]:
    try:
        _uid()
        return True, "odoo reachable"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


# ---------------------------------------------------------------------------
# Public, whitelisted read operations
# ---------------------------------------------------------------------------
def list_partners(limit: int = 50) -> list[dict]:
    return _search_read(
        "res.partner",
        [["customer_rank", ">", 0]],
        ["name", "email", "phone", "city", "country_id"],
        limit=limit,
    )


def list_products(limit: int = 50) -> list[dict]:
    return _search_read(
        "product.product",
        [["sale_ok", "=", True]],
        ["name", "list_price", "qty_available", "default_code"],
        limit=limit,
    )


def list_sales_orders(limit: int = 50) -> list[dict]:
    return _search_read(
        "sale.order",
        [],
        ["name", "partner_id", "amount_total", "state", "date_order"],
        limit=limit,
        order="date_order desc",
    )


def list_invoices(limit: int = 50) -> list[dict]:
    """Customer invoices (money owed TO the business)."""
    return _search_read(
        "account.move",
        [["move_type", "=", "out_invoice"], ["state", "=", "posted"]],
        ["name", "partner_id", "invoice_date", "amount_total", "amount_residual", "payment_state"],
        limit=limit,
        order="invoice_date desc",
    )


def list_bills(limit: int = 50) -> list[dict]:
    """Vendor bills (money the business OWES)."""
    return _search_read(
        "account.move",
        [["move_type", "=", "in_invoice"], ["state", "=", "posted"]],
        ["name", "partner_id", "invoice_date", "amount_total", "amount_residual", "payment_state"],
        limit=limit,
        order="invoice_date desc",
    )


def receivables(limit: int = 50) -> list[dict]:
    """Posted customer invoices not yet fully paid, with outstanding amount."""
    rows = _search_read(
        "account.move",
        [
            ["move_type", "=", "out_invoice"],
            ["state", "=", "posted"],
            ["payment_state", "in", ["not_paid", "partial"]],
        ],
        ["name", "partner_id", "invoice_date", "amount_total", "amount_residual"],
        limit=limit,
        order="invoice_date desc",
    )
    return rows


def payables(limit: int = 50) -> list[dict]:
    """Posted vendor bills not yet fully paid, with outstanding amount."""
    rows = _search_read(
        "account.move",
        [
            ["move_type", "=", "in_invoice"],
            ["state", "=", "posted"],
            ["payment_state", "in", ["not_paid", "partial"]],
        ],
        ["name", "partner_id", "invoice_date", "amount_total", "amount_residual"],
        limit=limit,
        order="invoice_date desc",
    )
    return rows
