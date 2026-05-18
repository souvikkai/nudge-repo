"use client";

import { useEffect, useState } from "react";
import { listItems } from "@/lib/itemsApi";
import type { ItemListEntry } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  model_key: "strong" | "mid" | "budget";
  provider: string;
  model: string;
  latency_ms: number | null;
  word_count: number | null;
  estimated_cost_usd: number | null;
  summary: string | null;
  status: "success" | "error";
  error: string | null;
}

interface BenchmarkResponse {
  item_id: string;
  input_chars: number;
  input_tokens_estimate: number;
  prompt_version: string;
  recommended_model_key: string;
  recommended_route_reason: string;
  results: BenchmarkResult[];
}

interface PromptCompareResponse {
  item_id: string;
  input_chars: number;
  input_tokens_estimate: number;
  model_key: string;
  results: { v0: BenchmarkResult; v1: BenchmarkResult };
}

interface AnalyticsInsightsPayload {
  route_reason_breakdown: Record<string, number>;
  failure_category_breakdown: Record<string, number>;
  fallback_retry_count: number;
  avg_estimated_cost_usd_by_model_key: Array<{ model_key: string; avg_estimated_cost_usd: number | null }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const PROMPT_VERSION_OPTIONS = ["v0", "v1"] as const;
type PromptVersionOption = (typeof PROMPT_VERSION_OPTIONS)[number];

async function runBenchmark(itemId: string, promptVersion: string): Promise<BenchmarkResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nudge_token") : null;
  const qs = new URLSearchParams({ prompt_version: promptVersion });
  const res = await fetch(`${API_BASE_URL}/benchmark/${itemId}?${qs}`, {
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

async function runPromptCompare(itemId: string): Promise<PromptCompareResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nudge_token") : null;
  const res = await fetch(`${API_BASE_URL}/benchmark/${itemId}/prompt-compare`, {
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
  return res.json() as Promise<PromptCompareResponse>;
}

async function fetchAnalyticsInsights(): Promise<AnalyticsInsightsPayload> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nudge_token") : null;
  const res = await fetch(`${API_BASE_URL}/analytics/`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let msg = raw;
    try { msg = (JSON.parse(raw) as { detail?: string }).detail ?? raw; } catch { /* */ }
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    route_reason_breakdown: (raw.route_reason_breakdown as Record<string, number>) ?? {},
    failure_category_breakdown: (raw.failure_category_breakdown as Record<string, number>) ?? {},
    fallback_retry_count: Number(raw.fallback_retry_count ?? 0),
    avg_estimated_cost_usd_by_model_key: Array.isArray(raw.avg_estimated_cost_usd_by_model_key)
      ? (raw.avg_estimated_cost_usd_by_model_key as AnalyticsInsightsPayload["avg_estimated_cost_usd_by_model_key"])
      : [],
  };
}

type BenchmarkViewState =
  | { kind: "single"; response: BenchmarkResponse }
  | { kind: "compare"; data: PromptCompareResponse };

function formatCost(usd: number): string {
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

function formatLatencyMaybe(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return formatLatency(ms);
}

function formatCostMaybe(usd: number | null | undefined): string {
  if (usd == null || Number.isNaN(usd)) return "—";
  return formatCost(usd);
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
  const [promptVersion, setPromptVersion] = useState<PromptVersionOption>("v0");
  const [comparePrompts, setComparePrompts] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [view, setView] = useState<BenchmarkViewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [analyticsInsights, setAnalyticsInsights] = useState<AnalyticsInsightsPayload | null>(null);
  const [analyticsInsightsError, setAnalyticsInsightsError] = useState<string | null>(null);
  const [analyticsInsightsLoading, setAnalyticsInsightsLoading] = useState(false);

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

  // System insights (analytics)
  useEffect(() => {
    if (!isAuthChecked) return;
    setAnalyticsInsightsLoading(true);
    setAnalyticsInsightsError(null);
    fetchAnalyticsInsights()
      .then(setAnalyticsInsights)
      .catch((e) => setAnalyticsInsightsError(e instanceof Error ? e.message : "Failed to load analytics"))
      .finally(() => setAnalyticsInsightsLoading(false));
  }, [isAuthChecked]);

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
    setView(null);
    setIsRunning(true);
    try {
      if (comparePrompts) {
        const data = await runPromptCompare(selectedItemId);
        setView({ kind: "compare", data });
      } else {
        const response = await runBenchmark(selectedItemId, promptVersion);
        setView({ kind: "single", response });
      }
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

  const singleResponse = view?.kind === "single" ? view.response : null;
  const successResults = singleResponse?.results.filter((r) => r.status === "success") ?? [];
  const fastestKey = successResults.length
    ? successResults.reduce((a, b) => {
        const la = a.latency_ms ?? Number.POSITIVE_INFINITY;
        const lb = b.latency_ms ?? Number.POSITIVE_INFINITY;
        return la <= lb ? a : b;
      }).model_key
    : null;
  const cheapestKey = successResults.length
    ? successResults.reduce((a, b) => {
        const ca = a.estimated_cost_usd ?? Number.POSITIVE_INFINITY;
        const cb = b.estimated_cost_usd ?? Number.POSITIVE_INFINITY;
        return ca <= cb ? a : b;
      }).model_key
    : null;
  const orderedResults = singleResponse
    ? TIER_ORDER.map((k) => singleResponse.results.find((r) => r.model_key === k)).filter(Boolean) as BenchmarkResult[]
    : [];

  const compareData = view?.kind === "compare" ? view.data : null;
  const strongCompareV0 = compareData?.results.v0;
  const strongCompareV1 = compareData?.results.v1;

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

        {/* System Insights */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.dim, marginBottom: 10 }}>
            System Insights
          </div>
          {analyticsInsightsLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: 12, minHeight: 72 }} />
              ))}
            </div>
          )}
          {analyticsInsightsError && !analyticsInsightsLoading && (
            <div style={{ fontSize: 12, color: C.red, borderRadius: 6, border: `1px solid ${C.redBdr}`, backgroundColor: C.redBg, padding: "10px 12px" }}>
              {analyticsInsightsError}
            </div>
          )}
          {analyticsInsights && !analyticsInsightsLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Route reason breakdown</div>
                {Object.keys(analyticsInsights.route_reason_breakdown).length === 0 ? (
                  <div style={{ fontSize: 11, color: C.muted }}>No data</div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries(analyticsInsights.route_reason_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <li key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, fontFamily: "monospace" }}>
                          <span style={{ wordBreak: "break-word", color: C.text }}>{k}</span>
                          <span style={{ color: C.bright, flexShrink: 0 }}>{v}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Failure category breakdown</div>
                {Object.keys(analyticsInsights.failure_category_breakdown).length === 0 ? (
                  <div style={{ fontSize: 11, color: C.muted }}>No data</div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries(analyticsInsights.failure_category_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <li key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, fontFamily: "monospace" }}>
                          <span style={{ wordBreak: "break-word", color: C.text }}>{k}</span>
                          <span style={{ color: C.bright, flexShrink: 0 }}>{v}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Fallback retry count</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.amber, fontFamily: "monospace" }}>
                  {analyticsInsights.fallback_retry_count}
                </div>
              </div>
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Avg est. cost by model_key</div>
                {analyticsInsights.avg_estimated_cost_usd_by_model_key.length === 0 ? (
                  <div style={{ fontSize: 11, color: C.muted }}>No data</div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {analyticsInsights.avg_estimated_cost_usd_by_model_key.map((row) => (
                      <li key={row.model_key} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, fontFamily: "monospace" }}>
                        <span style={{ color: TIER_ACCENT[row.model_key] ?? C.text }}>{row.model_key}</span>
                        <span style={{ color: C.bright, flexShrink: 0 }}>
                          {row.avg_estimated_cost_usd != null ? formatCost(row.avg_estimated_cost_usd) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

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
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignSelf: "flex-end" }}>
            <div>
              <label htmlFor="benchmark-prompt-version" style={{ display: "block", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>
                Prompt version
              </label>
              <select
                id="benchmark-prompt-version"
                value={promptVersion}
                onChange={(e) => setPromptVersion(e.target.value as PromptVersionOption)}
                disabled={isRunning || comparePrompts}
                style={{
                  width: "100%",
                  minWidth: 118,
                  borderRadius: 4,
                  border: `1px solid ${C.border2}`,
                  backgroundColor: C.bg3,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: C.bright,
                  outline: "none",
                  cursor: isRunning || comparePrompts ? "not-allowed" : "pointer",
                  fontFamily: "monospace",
                  opacity: isRunning || comparePrompts ? 0.5 : 1,
                }}
              >
                {PROMPT_VERSION_OPTIONS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="benchmark-compare-prompts"
                  checked={comparePrompts}
                  onChange={(e) => setComparePrompts(e.target.checked)}
                  disabled={isRunning}
                  style={{
                    width: 14,
                    height: 14,
                    accentColor: C.green,
                    cursor: isRunning ? "not-allowed" : "pointer",
                    opacity: isRunning ? 0.5 : 1,
                  }}
                />
                <label
                  htmlFor="benchmark-compare-prompts"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: C.text,
                    cursor: isRunning ? "not-allowed" : "pointer",
                    userSelect: "none",
                  }}
                >
                  Compare prompts
                </label>
              </div>
              {comparePrompts && (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    backgroundColor: C.bg,
                    padding: "10px 12px",
                    maxWidth: 304,
                    borderLeft: `3px solid ${C.border2}`,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.bright, marginBottom: 8, letterSpacing: "-0.01em" }}>
                    Prompt comparison mode
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <span style={{ color: C.bright }}>v0 — Faithful Summary</span>
                      <span style={{ display: "block", marginTop: 2 }}>
                        Compresses the article into a concise, neutral thesis + 3 key points.
                      </span>
                    </div>
                    <div>
                      <span style={{ color: C.bright }}>v1 — Reflection Note</span>
                      <span style={{ display: "block", marginTop: 2 }}>
                        Creates a more Nudge-native reflection note focused on why the article is worth revisiting.
                      </span>
                    </div>
                  </div>
                </div>
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
              {comparePrompts ? "Running strong tier × v0 & v1…" : "Querying all tiers in parallel…"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: comparePrompts ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 16 }}>
              {(comparePrompts ? ["v0 — strong", "v1 — strong"] : ["Strong", "Mid", "Budget"]).map((tier) => (
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
        {view && !isRunning && (
          view.kind === "compare" ? (
            <>
              {/* Stats bar — compare */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {[
                  { label: "Input tokens (est.)", value: view.data.input_tokens_estimate.toLocaleString(), accent: C.bright },
                  { label: "Input chars", value: view.data.input_chars.toLocaleString(), accent: C.bright },
                  { label: "v0 strong latency", value: formatLatencyMaybe(strongCompareV0?.latency_ms), accent: TIER_ACCENT.strong },
                  { label: "v1 strong latency", value: formatLatencyMaybe(strongCompareV1?.latency_ms), accent: TIER_ACCENT.strong },
                ].map(({ label, value, accent }, i) => (
                  <div key={label} style={{ backgroundColor: C.bg2, padding: "16px 20px", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Prompt versions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim }}>Prompt versions</span>
                <span style={{ borderRadius: 4, border: `1px solid ${C.border2}`, backgroundColor: C.bg3, padding: "2px 8px", fontSize: 12, color: C.mid }}>v0</span>
                <span style={{ borderRadius: 4, border: `1px solid ${C.border2}`, backgroundColor: C.bg3, padding: "2px 8px", fontSize: 12, color: C.mid }}>v1</span>
                <span style={{ fontSize: 11, color: C.dim }}>· {view.data.model_key} tier</span>
              </div>

              <p style={{ margin: "0 0 12px 0", fontSize: 12, color: C.dim, lineHeight: 1.5, maxWidth: 720 }}>
                Prompt comparison uses the strong tier only to isolate prompt behavior from model-tier differences.
              </p>

              {/* Strong × prompt side-by-side */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { key: "v0", heading: "v0 — Faithful Summary", r: strongCompareV0 },
                  { key: "v1", heading: "v1 — Reflection Note", r: strongCompareV1 },
                ].map(({ key, heading, r }) => {
                  const accent = TIER_ACCENT.strong;
                  const lines = r?.summary?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
                  const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
                  const paragraphs = lines.filter((l) => !l.startsWith("- "));

                  return (
                    <div
                      key={key}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${!r || r.status === "error" ? C.redBdr : C.border}`,
                        backgroundColor: C.bg2,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "-0.01em" }}>
                            {heading}
                          </span>
                          {r?.status === "error" && (
                            <span style={{ borderRadius: 4, border: `1px solid ${C.redBdr}`, backgroundColor: C.redBg, padding: "2px 8px", fontSize: 10, textTransform: "uppercase", color: C.red }}>
                              Error
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          {r ? `${r.provider} / ${r.model}` : "Strong tier not returned"}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: `1px solid ${C.border}` }}>
                        {[
                          { label: "Latency", value: formatLatencyMaybe(r?.latency_ms) },
                          { label: "Cost", value: formatCostMaybe(r?.estimated_cost_usd) },
                          { label: "Words", value: r?.word_count != null ? String(r.word_count) : "—" },
                        ].map(({ label, value }, i) => (
                          <div key={label} style={{ backgroundColor: C.bg2, padding: "12px 8px", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
                            <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: accent }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ flex: 1, padding: "16px 20px" }}>
                        {!r ? (
                          <p style={{ fontSize: 13, color: C.red, fontStyle: "italic", margin: 0 }}>No strong tier result in response.</p>
                        ) : r.status === "error" ? (
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
            </>
          ) : (
            <>
            {/* Stats bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
              {[
                { label: "Input tokens (est.)", value: view.response.input_tokens_estimate.toLocaleString(), accent: C.bright },
                { label: "Input chars", value: view.response.input_chars.toLocaleString(), accent: C.bright },
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
                {view.response.prompt_version}
              </span>
            </div>

            {/* Routing insight */}
            <div style={{
              marginBottom: 24,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              backgroundColor: C.bg2,
              padding: "14px 18px",
              borderLeft: `3px solid ${TIER_ACCENT[view.response.recommended_model_key] ?? C.mid}`,
            }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 10 }}>
                Routing insight
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.bright, lineHeight: 1.5 }}>
                <div>
                  <span style={{ color: C.muted }}>Recommended tier: </span>
                  <span style={{ fontWeight: 600, color: TIER_ACCENT[view.response.recommended_model_key] ?? C.bright }}>
                    {view.response.recommended_model_key}
                  </span>
                </div>
                <div style={{ wordBreak: "break-word" }}>
                  <span style={{ color: C.muted }}>Route reason: </span>
                  <span style={{ color: C.text }}>{view.response.recommended_route_reason}</span>
                </div>
              </div>
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
                        { label: "Latency", value: formatLatencyMaybe(r.latency_ms) },
                        { label: "Cost", value: formatCostMaybe(r.estimated_cost_usd) },
                        { label: "Words", value: r.word_count != null ? String(r.word_count) : "—" },
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
            {(() => {
              const latencyRows = successResults.filter((r) => r.latency_ms != null);
              return latencyRows.length > 1 ? (
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>Latency comparison</div>
                {[...latencyRows].sort((a, b) => (a.latency_ms! - b.latency_ms!)).map((r) => {
                  const maxMs = Math.max(...latencyRows.map((x) => x.latency_ms!));
                  const pct = ((r.latency_ms!) / maxMs) * 100;
                  const accent = TIER_ACCENT[r.model_key] ?? C.bright;
                  return (
                    <div key={r.model_key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted, width: 56, textTransform: "uppercase", letterSpacing: "0.1em" }}>{TIER_LABELS[r.model_key]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, backgroundColor: accent, width: `${pct}%`, transition: "width 0.7s ease" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent, width: 60, textAlign: "right" }}>{formatLatency(r.latency_ms!)}</span>
                    </div>
                  );
                })}
              </div>
              ) : null;
            })()}

            {/* Cost bar */}
            {(() => {
              const costRows = successResults.filter((r) => r.estimated_cost_usd != null);
              return costRows.length > 1 ? (
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg2, padding: "16px 20px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>Cost comparison</div>
                {[...costRows].sort((a, b) => (a.estimated_cost_usd! - b.estimated_cost_usd!)).map((r) => {
                  const maxCost = Math.max(...costRows.map((x) => x.estimated_cost_usd!));
                  const pct = ((r.estimated_cost_usd!) / maxCost) * 100;
                  const accent = TIER_ACCENT[r.model_key] ?? C.bright;
                  return (
                    <div key={r.model_key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted, width: 56, textTransform: "uppercase", letterSpacing: "0.1em" }}>{TIER_LABELS[r.model_key]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.bg3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, backgroundColor: accent, width: `${pct}%`, transition: "width 0.7s ease" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent, width: 72, textAlign: "right" }}>{formatCost(r.estimated_cost_usd!)}</span>
                    </div>
                  );
                })}
              </div>
              ) : null;
            })()}
            </>
          )
        )}

        {/* Empty state */}
        {!view && !isRunning && !error && (
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
