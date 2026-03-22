"use client";

import { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PerTierStat {
  model_key: string;
  provider: string | null;
  model: string | null;
  total_calls: number;
  success_count: number;
  failure_count: number;
  avg_latency_ms: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
}

interface DailyCount {
  date: string;
  count: number;
}

interface AnalyticsResponse {
  total_attempts: number;
  success_rate: number;
  per_tier: PerTierStat[];
  daily_counts: DailyCount[];
}

// ── API ───────────────────────────────────────────────────────────────────────

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nudge_token") : null;
  const res = await fetch(`${API_BASE_URL}/analytics`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let msg = raw;
    try {
      msg = (JSON.parse(raw) as { detail?: string }).detail ?? raw;
    } catch {
      /* */
    }
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<AnalyticsResponse>;
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
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
  bg: "#0a0a0a",
  bg2: "#0e0e0e",
  bg3: "#111111",
  border: "#1e1e1e",
  border2: "#2a2a2a",
  dim: "#444444",
  muted: "#555555",
  mid: "#888888",
  text: "#aaaaaa",
  bright: "#e8e8e8",
  white: "#ffffff",
  green: "#3a7d44",
  greenBg: "#1a2e1a",
  greenBdr: "#2a4a2a",
  amber: "#c4921a",
  amberBg: "#2a1e08",
  amberBdr: "#4a3a10",
  red: "#e87a7a",
  redBg: "#1a0808",
  redBdr: "#5c1e1e",
};

function tierAccent(modelKey: string): string {
  return TIER_ACCENT[modelKey] ?? C.mid;
}

function sortPerTier(rows: PerTierStat[]): PerTierStat[] {
  const order = (k: string) => {
    const i = TIER_ORDER.indexOf(k);
    return i === -1 ? 99 : i;
  };
  return [...rows].sort((a, b) => order(a.model_key) - order(b.model_key));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("nudge_token");
    if (!token) {
      window.location.href = "/login";
    } else {
      setIsAuthChecked(true);
    }
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

  useEffect(() => {
    if (!isAuthChecked) return;
    setLoading(true);
    setError(null);
    fetchAnalytics()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [isAuthChecked]);

  const perTierSorted = useMemo(() => (data ? sortPerTier(data.per_tier) : []), [data]);

  const totalCallsAcrossTiers = useMemo(
    () => perTierSorted.reduce((s, t) => s + t.total_calls, 0),
    [perTierSorted]
  );

  const chartMax = useMemo(() => {
    if (!data?.daily_counts?.length) return 1;
    return Math.max(1, ...data.daily_counts.map((d) => d.count));
  }, [data]);

  if (!isAuthChecked) return null;

  const successPct = data ? Math.round(data.success_rate * 1000) / 10 : 0;
  const tiersActive = data?.per_tier.length ?? 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.bright, fontFamily: "monospace" }}>
      <div
        style={{
          pointerEvents: "none",
          position: "fixed",
          inset: 0,
          zIndex: 50,
          opacity: 0.03,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)",
        }}
      />

      <header
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a
            href="/"
            style={{
              color: C.muted,
              textDecoration: "none",
              fontSize: 13,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            ← Nudge
          </a>
          <div style={{ width: 1, height: 16, backgroundColor: C.border2 }} />
          <div style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase" }}>
            <span style={{ color: C.green }}>Inference</span>
            <span style={{ color: C.bright, marginLeft: 4 }}>Observatory</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: C.amber,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 12, color: C.muted }}>METRICS</span>
        </div>
      </header>

      <main style={{ maxWidth: 1152, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: C.white, margin: 0 }}>
            Inference Observatory
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: C.muted, maxWidth: 560, lineHeight: 1.6 }}>
            Summary attempt telemetry across your tiers — throughput, reliability, and latency distribution over the last 14 days.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 24,
              borderRadius: 6,
              border: `1px solid ${C.redBdr}`,
              backgroundColor: C.redBg,
              padding: "12px 16px",
              fontSize: 13,
              color: C.red,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 13, color: C.muted }}>Loading analytics…</div>
        ) : data ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 32,
              }}
            >
              {[
                { label: "Total attempts", value: String(data.total_attempts) },
                { label: "Success rate", value: `${successPct}%` },
                { label: "Tiers active", value: String(tiersActive) },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    borderRadius: 6,
                    border: `1px solid ${C.border2}`,
                    backgroundColor: C.bg3,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted }}>
                    {s.label}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: C.white }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: C.muted,
                  marginBottom: 16,
                }}
              >
                Per-tier performance
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {perTierSorted.map((t) => {
                  const accent = tierAccent(t.model_key);
                  const label = TIER_LABELS[t.model_key] ?? t.model_key;
                  const providerModel = [t.provider, t.model].filter(Boolean).join(" / ") || "—";
                  return (
                    <div
                      key={`${t.model_key}-${t.provider ?? ""}-${t.model ?? ""}`}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${C.border2}`,
                        backgroundColor: C.bg2,
                        padding: 16,
                        borderLeft: `3px solid ${accent}`,
                      }}
                    >
                      <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: accent }}>
                        {label}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>{t.model_key}</div>
                      <div style={{ marginTop: 8, fontSize: 12, color: C.text }}>{providerModel}</div>
                      <div
                        style={{
                          marginTop: 14,
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <span style={{ color: C.dim }}>Calls</span>{" "}
                          <span style={{ color: C.bright }}>{t.total_calls}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>OK</span>{" "}
                          <span style={{ color: C.green }}>{t.success_count}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>Fail</span>{" "}
                          <span style={{ color: C.red }}>{t.failure_count}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>Avg</span>{" "}
                          <span style={{ color: C.bright }}>{formatLatency(t.avg_latency_ms)}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>p50</span>{" "}
                          <span style={{ color: C.bright }}>{formatLatency(t.p50_latency_ms)}</span>
                        </div>
                        <div>
                          <span style={{ color: C.dim }}>p95</span>{" "}
                          <span style={{ color: C.bright }}>{formatLatency(t.p95_latency_ms)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {perTierSorted.length === 0 && (
                <div style={{ fontSize: 13, color: C.muted, padding: 16 }}>No tier data yet.</div>
              )}
            </div>

            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: C.muted,
                  marginBottom: 16,
                }}
              >
                Activity (14 days)
              </h2>
              <div
                style={{
                  borderRadius: 8,
                  border: `1px solid ${C.border2}`,
                  backgroundColor: C.bg3,
                  padding: "20px 16px 12px",
                }}
              >
                <svg
                  width="100%"
                  height={180}
                  viewBox="0 0 560 180"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ display: "block" }}
                >
                  <rect width="560" height="180" fill={C.bg3} />
                  {data.daily_counts.map((d, i) => {
                    const n = data.daily_counts.length;
                    const gap = 4;
                    const barW = (560 - gap * (n - 1)) / n;
                    const x = i * (barW + gap);
                    const h = chartMax > 0 ? (d.count / chartMax) * 140 : 0;
                    const y = 160 - h;
                    return (
                      <g key={d.date}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={Math.max(0, h)}
                          fill={C.green}
                          opacity={0.85}
                        />
                        <text
                          x={x + barW / 2}
                          y={175}
                          textAnchor="middle"
                          fill={C.dim}
                          fontSize="8"
                          fontFamily="monospace"
                        >
                          {d.date.slice(5)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: C.muted,
                  marginBottom: 16,
                }}
              >
                Call share by tier
              </h2>
              <div
                style={{
                  borderRadius: 8,
                  border: `1px solid ${C.border2}`,
                  backgroundColor: C.bg2,
                  padding: 16,
                }}
              >
                {perTierSorted.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.muted }}>No calls recorded.</div>
                ) : (
                  perTierSorted.map((t) => {
                    const share = totalCallsAcrossTiers > 0 ? (t.total_calls / totalCallsAcrossTiers) * 100 : 0;
                    const accent = tierAccent(t.model_key);
                    const label = TIER_LABELS[t.model_key] ?? t.model_key;
                    return (
                      <div key={`usage-${t.model_key}-${t.provider ?? ""}-${t.model ?? ""}`} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: C.text }}>
                            {label}{" "}
                            <span style={{ color: C.dim }}>({t.model_key})</span>
                          </span>
                          <span style={{ color: C.muted }}>
                            {t.total_calls} · {share.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: C.bg3,
                            border: `1px solid ${C.border}`,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${share}%`,
                              height: "100%",
                              backgroundColor: accent,
                              opacity: 0.9,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
