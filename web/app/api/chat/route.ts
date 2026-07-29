import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { checkToken, COOKIE_NAME } from "@/lib/auth";
import { tools, runTool } from "@/lib/tools";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Create the client lazily inside the request handler. Instantiating at module
// load makes `next build` evaluate it (during "Collecting page data") before any
// env vars exist, and the OpenAI SDK throws when the key is absent — which fails
// the Vercel build. This runs only at request time, when GEMINI_API_KEY is set.
function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

const SYSTEM = `You are a friendly ERP assistant connected to a business's LIVE Odoo data.
Rules:
- Answer ONLY using the provided tools. Never invent or estimate figures.
- amount_residual on an invoice/bill is the outstanding (unpaid) amount; amount_total is the full amount.
- Report amounts with the currency shown in the data (assume company currency if unspecified).
- Be concise. When listing several records, use a small markdown table.
- If a tool returns nothing or an error, say the data isn't available rather than guessing.
- This is demo/educational data; do not claim it is audited or official.`;

type ChatMsg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const jar = await cookies();
  if (!checkToken(jar.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Unauthorized. Enter the passcode." }, { status: 401 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  }

  let messages: ChatMsg[] = [];
  try {
    ({ messages } = await req.json());
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convo: any[] = [{ role: "system", content: SYSTEM }, ...messages.slice(-12)];

  const client = getClient();

  try {
    for (let hop = 0; hop < 5; hop++) {
      const resp = await client.chat.completions.create({
        model: MODEL,
        messages: convo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: tools as any,
        temperature: 0.2,
      });
      const msg = resp.choices[0].message;
      convo.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return NextResponse.json({ reply: msg.content ?? "" });
      }

      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* ignore malformed args */
        }
        const result = await runTool(tc.function.name, args);
        convo.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }
    return NextResponse.json({ reply: "That took too many steps — please rephrase." });
  } catch (e) {
    const status =
      (e as { status?: number })?.status ??
      (e as { response?: { status?: number } })?.response?.status;
    if (status === 429) {
      return NextResponse.json(
        { error: "The assistant is busy right now (rate limit). Please wait a few seconds and try again." },
        { status: 429 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Model error: ${msg}` }, { status: 500 });
  }
}
