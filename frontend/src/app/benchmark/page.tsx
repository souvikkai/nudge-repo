"use client";

import { useEffect, useState } from "react";
import { listItems } from "@/lib/itemsApi";
import type { ItemListEntry } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  model_key: "strong" | "mid" | "budget";
  provider: string;
  model: string;
  latency_ms: number;
  word_count: number;
  estimated_cost_usd: number;
  summary: string;
  status: "success" | "error";
  error: string | null;
}

interface BenchmarkResponse {
  item_id: string;
  input_chars: number;
  input_tokens_estimate: number;
  prompt_version: string;
  results: BenchmarkResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function runBenchmark(itemId: string): Promise<BenchmarkResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nudge_token") : null;
  const res = await fetch(`${API_BASE_URL}/benchmark/${itemId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let msg = raw;
    try { msg = (JSON.parse(raw) as { detail?: string }).detail ?? raw; } catch { /* */ }
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<BenchmarkResponse>;
}

function formatCost(usd: number): string {
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

const TIER_LABELS: Record<string, string> = { strong: "Strong", mid: "Mid", budget: "Budget" };
const TIER_ORDER = ["strong", "mid", "budget"];
const TIER_ACCENT: Record<string, string> = {
  strong: "#7b93ff",
  mid: "#3a7d44",
  budget: "#c4921a",
};

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  bg:       "#0a0a0a",
  bg2:      "#0e0e0e",
  bg3:      "#111111",
  border:   "#1e1e1e",
  border2:  "#2a2a2a",
  dim:      "#444444",
  muted:    "#555555",
  mid:      "#888888",
  text:     "#aaaaaa",
  bright:   "#e8e8e8",
  white:    "#ffffff",
  green:    "#3a7d44",
  greenBg:  "#1a2e1a",
  greenBdr: "#2a4a2a",
  amber:    "#c4921a",
  amberBg:  "#2a1e08",
  amberBdr: "#4a3a10",
  red:      "#e87a7a",
  redBg:    "#1a0808",
  redBdr:   "#5c1e1e",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [items, setItems] = useState<ItemListEntry[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("nudge_token");
    if (!token) { window.location.href = "/login"; }
    else { setIsAuthChecked(true); }
  }, []);

  // Override yellow body background for this dark page
  useEffect(() => {
    const prevBg = document.body.style.background;
    const prevBgColor = document.body.style.backgroundColor;
    const prevColor = document.body.style.color;
    document.body.style.background = C.bg;
    document.body.style.backgroundColor = C.bg;
    document.body.style.color = C.bright;
    return () => {
      document.body.style.background = prevBg;
      document.body.style.backgroundColor = prevBgColor;
      document.body.style.color = prevColor;
    };
  }, []);

  // Load succeeded items
  useEffect(() => {
    if (!isAuthChecked) return;
    setLoadingItems(true);
    listItems()
      .then((resp) => {
        const succeeded = resp.items.filter((i) => i.status === "succeeded");
        setItems(succeeded);
        if (succeeded.length > 0) setSelectedItemId(succeeded[0].id);
      })
      .catch(() => setError("Failed to load articles."))
      .finally(() => setLoadingItems(false));
  }, [isAuthChecked]);

  async function handleRun() {
    if (!selectedItemId) return;
    setError(null);
    setResult(null);
    setIsRunning(true);
    try {
      const data = await runBenchmark(selectedItemId);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Benchmark failed");
    } finally {
      setIsRunning(false);
    }
  }

  function getItemLabel(item: ItemListEntry): string {
    if (item.title) return item.title;
    if (item.requested_url) return item.requested_url;
    return "Text note";
  }

  const successResults = result?.results.filter((r) => r.status === "success") ?? [];
  const fastestKey = successResults.length
    ? successResults.reduce((a, b) => (a.latency_ms < b.latency_ms ? a : b)).model_key : null;
  const cheapestKey = successResults.length
    ? successResults.reduce((a, b) => (a.estimated_cost_usd < b.estimated_cost_usd ? a : b)).model_key : null;
  const orderedResults = result
    ? TIER_ORDER.map((k) => result.results.find((r) => r.model_key === k)).filter(Boolean) as BenchmarkResult[]
    : [];

  if (!isAuthChecked) return null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.bright, fontFamily: "monospace" }}>

      {/* Scanline overlay */}
      <div style={{
        pointerEvents: "none", position: "fixed", inset: 0, zIndex: 50, opacity: 0.03,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)",
      }} />

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            ← Nudge
          </a>
          <div style={{ width: 1, height: 16, backgroundColor: C.border2 }} />
          <div style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase" }}>
            <span style={{ color: C.green }}>Model</span>
            <span style={{ color: C.bright, marginLeft: 4 }}>Benchmark</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.green, display: "inline-block" }} />
          <span style={{ fontSize: 12, color: C.muted }}>LIVE</span>
        </div>
      </header>

      <main style={{ maxWidth: 1152, margin: "0 auto", padding: "40px 24px" }}>

        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.white, margin: 0 }}>
            Model Performance Benchmark
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: C.muted, maxWidth: 520, lineHeight: 1.6 }}>
            Runs your article through all three LLM tiers in parallel — Strong, Mid, and Budget — and compares latency, cost, and output quality side by side.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, marginBottom: 32 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
              Select Article
            </label>
            {loadingItems ? (
              <div style={{ height: 40, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg3 }} />
            ) : (
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                disabled={isRunning}
                style={{
                  width: "100%", borderRadius: 6, border: `1px solid ${C.border2}`,
                  backgroundColor: C.bg3, padding: "8px 12px", fontSize: 13,
                  color: C.bright, outline: "none", cursor: "pointer",
                  opacity: isRunning ? 0.5 : 1,
                }}
              >
                {items.length === 0 && <option value="">No articles available</option>}
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{getItemLabel(item)}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || !selectedItemId || items.length === 0}
            style={{
              borderRadius: 6, border: `1px solid ${C.green}`,
              backgroundColor: "rgba(58,125,68,0.1)", padding: "10px 24px",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.15em",
              textTransform: "uppercase", color: C.green, cursor: "pointer",
              opacity: (isRunning || !selectedItemId || items.length === 0) ? 0.4 : 1,
              fontFamily: "monospace",
            }}
          >
            {isRunning ? "Running…" : "Run Benchmark"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 24, borderRadius: 6, border: `1px solid ${C.redBdr}`, backgroundColor: C.redBg, padding: "12px 16px", fontSize: 13, color: C.red }}>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {isRunning && (
          <div style={{ marginBottom: 32, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>
              Querying all tiers in parallel…
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {["Strong", "Mid", "Budget"].map((tier) => (
                <div key={tier} style={{ borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, padding: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>{tier}</div>
                  {[100, 75, 50].map((w) => (
                    <div key={w} style={{ height: 10, borderRadius: 4, backgroundColor: C.bg3, marginBottom: 8, width: `${w}%` }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !isRunning && (
          <>
            {/* Stats bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
              {[
                { label: "Input tokens (est.)", value: result.input_tokens_estimate.toLocaleString(), accent: C.bright },
                { label: "Input chars", value: result.input_chars.toLocaleString(), accent: C.bright },
                { label: "Fastest tier", value: fastestKey ? `${TIER_LABELS[fastestKey]} ⚡` : "—", accent: C.green },
                { label: "Cheapest tier", value: cheapestKey ? `${TIER_LABELS[cheapestKey]} 💰` : "—", accent: C.amber },
              ].map(({ label, value, accent }, i) => (
                <div key={label} style={{ backgroundColor: C.bg2, padding: "16px 20px", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Prompt version */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim }}>Prompt version</span>
              <span style={{ borderRadius: 4, border: `1px solid ${C.border2}`, backgroundColor: C.bg3, padding: "2px 8px", fontSize: 12, color: C.mid }}>
                {result.prompt_version}
              </span>
            </div>

            {/* Model cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {orderedResults.map((r) => {
                const accent = TIER_ACCENT[r.model_key] ?? C.bright;
                const isFastest = r.model_key === fastestKey;
                const isCheapest = r.model_key === cheapestKey;
                const lines = r.summary?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
                const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
                const paragraphs = lines.filter((l) => !l.startsWith("- "));

                return (
                  <div key={r.model_key} style={{
                    borderRadius: 8,
                    border: `1px solid ${r.status === "error" ? C.redBdr : C.border}`,
                    backgroundColor: C.bg2, display: "flex", flexDirection: "column", overflow: "hidden",
                  }}>
                    {/* Card header */}
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, color: accent }}>
                          {TIER_LABELS[r.model_key]}
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          {isFastest && (
                            <span style={{ borderRadius: 4, border: `1px solid ${C.greenBdr}`, backgroundColor: C.greenBg, padding: "2px 8px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.green }}>
                              ⚡ Fastest
                            </span>
                          )}
                          {isCheapest && (
                            <span style={{ borderRadius: 4, border: `1px solid ${C.amberBdr}`, backgroundColor: C.amberBg, padding: "2px 8px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.amber }}>
                              💰 Cheapest
                            </span>
                          )}
                          {r.status === "error" && (
                            <span style={{ borderRadius: 4, border: `1px solid ${C.redBdr}`, backgroundColor: C.redBg, padding: "2px 8px", fontSize: 10, textTransform: "uppercase", color: C.red }}>
                              Error
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>{r.provider} / {r.model}</div>
                    </div>

                    {/* Metrics row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: `1px solid ${C.border}` }}>
                      {[
                        { label: "Latency", value: formatLatency(r.latency_ms) },
                        { label: "Cost", value: formatCost(r.estimated_cost_usd) },
                        { label: "Words", value: String(r.word_count) },
                      ].map(({ label, value }, i) => (
                        <div key={label} style={{ backgroundColor: C.bg2, padding: "12px 8px", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: accent }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Summary text */}
                    <div style={{ flex: 1, padding: "16px 20px" }}>
                      {r.status === "error" ? (
                        <p style={{ fontSize: 13, color: C.red, fontStyle: "italic", margin: 0 }}>{r.error ?? "Unknown error"}</p>
                      ) : (
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, fontFamily: "var(--font-geist-sans), sans-serif" }}>
                          {paragraphs.map((p, i) => <p key={i} style={{ margin: "0 0 8px 0" }}>{p}</p>)}
                          {bullets.length > 0 && (
                            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0" }}>
                              {bullets.map((b, i) => (
                                <li key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                                  <span style={{ color: accent, flexShrink: 0 }}>—</span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Latency bar */}
            {successResults.length > 1 && (
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>Latency comparison</div>
                {[...successResults].sort((a, b) => a.latency_ms - b.latency_ms).map((r) => {
                  const maxMs = Math.max(...successResults.map((x) => x.latency_ms));
                  const pct = (r.latency_ms / maxMs) * 100;
                  const accent = TIER_ACCENT[r.model_key] ?? C.bright;
                  return (
                    <div key={r.model_key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted, width: 56, textTransform: "uppercase", letterSpacing: "0.1em" }}>{TIER_LABELS[r.model_key]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, backgroundColor: accent, width: `${pct}%`, transition: "width 0.7s ease" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent, width: 60, textAlign: "right" }}>{formatLatency(r.latency_ms)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cost bar */}
            {successResults.length > 1 && (
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "16px 20px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>Cost comparison</div>
                {[...successResults].sort((a, b) => a.estimated_cost_usd - b.estimated_cost_usd).map((r) => {
                  const maxCost = Math.max(...successResults.map((x) => x.estimated_cost_usd));
                  const pct = (r.estimated_cost_usd / maxCost) * 100;
                  const accent = TIER_ACCENT[r.model_key] ?? C.bright;
                  return (
                    <div key={r.model_key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted, width: 56, textTransform: "uppercase", letterSpacing: "0.1em" }}>{TIER_LABELS[r.model_key]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, backgroundColor: accent, width: `${pct}%`, transition: "width 0.7s ease" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent, width: 72, textAlign: "right" }}>{formatCost(r.estimated_cost_usd)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!result && !isRunning && !error && (
          <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, opacity: 0.2, marginBottom: 16 }}>◈</div>
            <div style={{ fontSize: 13, color: C.muted }}>
              Select an article and click <span style={{ color: C.mid }}>Run Benchmark</span> to compare models.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
