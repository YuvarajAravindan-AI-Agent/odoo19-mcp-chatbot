// Minimal passcode gate. The passcode never reaches the client; on success we
// set an httpOnly cookie whose value is an HMAC derived from the passcode, so
// it can't be forged without knowing ACCESS_PASSCODE.
import crypto from "crypto";

const PASSCODE = process.env.ACCESS_PASSCODE || "";
export const COOKIE_NAME = "oc_auth";

export function makeToken(): string {
  return crypto
    .createHmac("sha256", PASSCODE || "unset")
    .update("odoo-chatbot-v1")
    .digest("hex");
}

export function checkPasscode(input: string): boolean {
  return !!PASSCODE && input === PASSCODE;
}

export function checkToken(token: string | undefined): boolean {
  return !!PASSCODE && !!token && token === makeToken();
}
