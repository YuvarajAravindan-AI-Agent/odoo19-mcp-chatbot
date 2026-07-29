"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant" | "error"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAMPLES = [
  "What's my total receivables?",
  "Show recent invoices",
  "List my customers",
  "What products do I have in stock?",
];

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [gateErr, setGateErr] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuthed(localStorage.getItem("oc_authed") === "1");
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setGateErr("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      localStorage.setItem("oc_authed", "1");
      setAuthed(true);
    } else {
      setGateErr("Incorrect passcode");
    }
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);

    const body = JSON.stringify({
      messages: next
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role, content: m.content })),
    });

    // The connection to the live ERP can blip (tunnel reconnect / cold start).
    // Retry transient failures a few times so it stays invisible to the user.
    const MAX_ATTEMPTS = 3;
    let lastError = "Couldn't reach your Odoo just now — the connection blipped. Please try again.";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (res.status === 401) {
          localStorage.removeItem("oc_authed");
          setAuthed(false);
          setBusy(false);
          return;
        }

        // Transient server-side failure (timeout / tunnel blip / cold start) → retry
        if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
          await sleep(1200 * attempt);
          continue;
        }

        const data = await res.json().catch(() => ({} as { error?: string; reply?: string }));
        if (!res.ok) {
          setMessages([...next, { role: "error", content: data.error || lastError }]);
        } else {
          setMessages([...next, { role: "assistant", content: data.reply || "(no answer)" }]);
        }
        setBusy(false);
        return;
      } catch {
        // Network-level failure (fetch threw) → retry
        if (attempt < MAX_ATTEMPTS) {
          await sleep(1200 * attempt);
          continue;
        }
      }
    }
    setMessages([...next, { role: "error", content: lastError }]);
    setBusy(false);
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="gate">
        <form className="card" onSubmit={login}>
          <h1>Ask Your Odoo</h1>
          <p>Enter the passcode shared with you.</p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            autoFocus
          />
          <button type="submit">Enter</button>
          <div className="err">{gateErr}</div>
        </form>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="header">
        <span className="dot" />
        <h1>Ask Your Odoo</h1>
        <span className="sub">live · demo data</span>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty">
            <h2>Ask about your ERP</h2>
            <div>Receivables, invoices, customers, products — in plain English.</div>
            <div className="chips">
              {SAMPLES.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`} dangerouslySetInnerHTML={{ __html: render(m.content) }} />
          ))
        )}
        {busy && <div className="msg assistant typing">Checking your Odoo…</div>}
        <div ref={endRef} />
      </div>

      {messages.length > 0 && (
        <div className="suggestions">
          {SAMPLES.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

// Tiny, safe-ish markdown-ish renderer: escapes HTML, then formats simple
// tables, bold, and line breaks. Enough for the assistant's short answers.
function render(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let table: string[][] | null = null;
  const flush = () => {
    if (table && table.length) {
      const rows = table.filter((r) => !r.every((c) => /^-+$/.test(c.trim())));
      const body = rows
        .map(
          (r, idx) =>
            "<tr>" +
            r.map((c) => `<${idx === 0 ? "th" : "td"}>${c.trim()}</${idx === 0 ? "th" : "td"}>`).join("") +
            "</tr>"
        )
        .join("");
      out.push(`<table>${body}</table>`);
    }
    table = null;
  };
  for (const ln of lines) {
    if (ln.includes("|") && ln.trim().startsWith("|")) {
      const cells = ln.split("|").slice(1, -1);
      (table ||= []).push(cells);
    } else {
      flush();
      out.push(ln);
    }
  }
  flush();
  return out
    .join("\n")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}
