"""
Local READ-ONLY proxy in front of the Odoo instance.

Runs on your laptop. A tunnel exposes ONLY this proxy to the internet, never
Odoo's raw :8069 port. The Vercel app calls these endpoints with a bearer
token; Gemini can only reach the fixed, read-only operations defined in
odoo_client.py.
"""
import os

from dotenv import load_dotenv

load_dotenv()  # must run before importing odoo_client, which reads env vars at import time

from fastapi import Depends, FastAPI, Header, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

import odoo_client as odoo  # noqa: E402

TOKEN = os.getenv("ODOO_PROXY_TOKEN")

app = FastAPI(title="Odoo Read-Only Proxy", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN:
        raise HTTPException(status_code=500, detail="Proxy token not configured on server")
    if authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    ok, detail = odoo.ping()
    return {"status": "ok", "odoo_reachable": ok, "detail": detail}


@app.get("/partners", dependencies=[Depends(require_token)])
def partners():
    return {"partners": odoo.list_partners()}


@app.get("/products", dependencies=[Depends(require_token)])
def products():
    return {"products": odoo.list_products()}


@app.get("/sales_orders", dependencies=[Depends(require_token)])
def sales_orders():
    return {"sales_orders": odoo.list_sales_orders()}


@app.get("/invoices", dependencies=[Depends(require_token)])
def invoices():
    return {"invoices": odoo.list_invoices()}


@app.get("/bills", dependencies=[Depends(require_token)])
def bills():
    return {"bills": odoo.list_bills()}


@app.get("/receivables", dependencies=[Depends(require_token)])
def receivables():
    return {"receivables": odoo.receivables()}


@app.get("/payables", dependencies=[Depends(require_token)])
def payables():
    return {"payables": odoo.payables()}
