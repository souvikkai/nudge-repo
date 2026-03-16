"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemDetailResponse, ItemListEntry, ItemStatus, SummaryResponse } from "@/lib/types";
import { createItem, generateSummary, getItem, listItems, patchItemText } from "@/lib/itemsApi";

type AutosaveStatus = "idle" | "typing" | "saving" | "saved" | "error" | "invalid";

function getStatusCopy(item: ItemListEntry): {
  pill: string;
  subtitle: string;
  debug?: string;
} {
  const { status, status_detail } = item;
  switch (status) {
    case "queued":
      return { pill: "Queued", subtitle: "In line to read this…", debug: status_detail || undefined };
    case "processing":
      return { pill: "Reading…", subtitle: "Pulling the best text from the link…", debug: status_detail || undefined };
    case "succeeded":
      return { pill: "Ready", subtitle: "Saved for your next review.", debug: status_detail || undefined };
    case "needs_user_text":
      return { pill: "Needs text", subtitle: "Can't access this link. Paste the text and we'll save it.", debug: status_detail || undefined };
    case "failed":
      return { pill: "Failed", subtitle: "We couldn't save this. Try again or paste the text.", debug: status_detail || undefined };
    default:
      return { pill: status, subtitle: "", debug: status_detail || undefined };
  }
}

function StatusPill({ label, status }: { label: string; status: ItemStatus }) {
  const statusStyles = useMemo(() => {
    switch (status) {
      case "succeeded": return "bg-white/30 text-black border-black/20";
      case "needs_user_text": return "bg-white/35 text-black border-black/25";
      case "queued":
      case "processing": return "bg-white/20 text-black/80 border-black/15";
      case "failed": return "bg-white/30 text-[#8b1a1a] border-[#8b1a1a]/30";
      default: return "bg-white/20 text-black/80 border-black/15";
    }
  }, [status]);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles}`}>
      {label}
    </span>
  );
}

export default function Page() {
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [items, setItems] = useState<ItemListEntry[]>([]);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackTextById, setFallbackTextById] = useState<Record<string, string>>({});
  const [fallbackSubmittingById, setFallbackSubmittingById] = useState<Record<string, boolean>>({});
  const [viewTab, setViewTab] = useState<"digest" | "saved">("digest");
  const [showSummary, setShowSummary] = useState(false);
  const [showNeedsText, setShowNeedsText] = useState(false);
  const [hasSummarized, setHasSummarized] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryById, setSummaryById] = useState<Record<string, SummaryResponse>>({});
  const [summaryErrorById, setSummaryErrorById] = useState<Record<string, string>>({});
  const [includePreviousItems, setIncludePreviousItems] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedUrl, setLastSavedUrl] = useState<string>("");
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSavedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [textAutosaveStatus, setTextAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedText, setLastSavedText] = useState<string>("");
  const textAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textClearSavedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshItems = useCallback(async (isManual = false) => {
    if (isManual) setIsManualRefresh(true);
    try {
      const response = await listItems();
      setItems(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load items");
    } finally {
      if (isManual) setIsManualRefresh(false);
    }
  }, []);

  async function handleSubmitFallbackText(itemId: string) {
    const pastedText = fallbackTextById[itemId]?.trim();
    if (!pastedText) { setError("Please paste text before submitting."); return; }
    setFallbackSubmittingById((prev) => ({ ...prev, [itemId]: true }));
    setError(null);
    try {
      await patchItemText(itemId, pastedText);
      setFallbackTextById((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
      await refreshItems();
      if (hasSummarized) {
        try {
          const summary = await generateSummary(itemId);
          setSummaryById((prev) => ({ ...prev, [itemId]: summary }));
          setSummaryErrorById((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
        } catch (e) {
          setSummaryErrorById((prev) => ({ ...prev, [itemId]: e instanceof Error ? e.message : "Summary failed" }));
        }
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        setError("This item already moved forward — refresh to see the latest status.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to submit text");
      }
    } finally {
      setFallbackSubmittingById((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
    }
  }

  useEffect(() => { refreshItems(); }, [refreshItems]);

  useEffect(() => {
    const hasInProgress = items.some((item) => item.status === "queued" || item.status === "processing");
    if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
    if (hasInProgress) {
      pollingIntervalRef.current = setInterval(() => { refreshItems(); }, 1500);
    }
    return () => { if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; } };
  }, [items, refreshItems]);

  useEffect(() => {
    if (inputType !== "url") { setAutosaveStatus("idle"); return; }
    const trimmed = url.trim();
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    if (clearSavedStatusTimeoutRef.current) { clearTimeout(clearSavedStatusTimeoutRef.current); clearSavedStatusTimeoutRef.current = null; }
    if (!trimmed) { setAutosaveStatus("idle"); return; }
    let isValidUrl = false;
    try { new URL(trimmed); isValidUrl = true; } catch { isValidUrl = false; }
    if (!isValidUrl) { setAutosaveStatus("invalid"); return; }
    if (trimmed === lastSavedUrl) { setAutosaveStatus("saved"); return; }
    setAutosaveStatus("typing");
    autosaveTimeoutRef.current = setTimeout(async () => {
      setAutosaveStatus("saving");
      try {
        const createResponse = await createItem({ url: trimmed });
        setLastSavedUrl(trimmed);
        setAutosaveStatus("saved");
        const fullEntry = await getItem(createResponse.id, false);
        setItems((prev) => [fullEntry, ...prev]);
        if (hasSummarized) {
          try {
            const summary = await generateSummary(fullEntry.id);
            setSummaryById((prev) => ({ ...prev, [fullEntry.id]: summary }));
          } catch (e) {
            setSummaryErrorById((prev) => ({
              ...prev,
              [fullEntry.id]: e instanceof Error ? e.message : "Summary failed",
            }));
          }
        }
        setUrl("");
        setTimeout(() => urlInputRef.current?.focus(), 0);
        clearSavedStatusTimeoutRef.current = setTimeout(() => { setAutosaveStatus("idle"); clearSavedStatusTimeoutRef.current = null; }, 2000);
      } catch { setAutosaveStatus("error"); }
    }, 700);
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
      if (clearSavedStatusTimeoutRef.current) { clearTimeout(clearSavedStatusTimeoutRef.current); clearSavedStatusTimeoutRef.current = null; }
    };
  }, [url, inputType, lastSavedUrl]);

  useEffect(() => {
    if (inputType !== "text") { setTextAutosaveStatus("idle"); return; }
    const trimmed = text.trim();
    if (textAutosaveTimeoutRef.current) clearTimeout(textAutosaveTimeoutRef.current);
    if (textClearSavedStatusTimeoutRef.current) { clearTimeout(textClearSavedStatusTimeoutRef.current); textClearSavedStatusTimeoutRef.current = null; }
    if (!trimmed) { setTextAutosaveStatus("idle"); return; }
    if (trimmed === lastSavedText) { setTextAutosaveStatus("saved"); return; }
    setTextAutosaveStatus("typing");
    textAutosaveTimeoutRef.current = setTimeout(async () => {
      setTextAutosaveStatus("saving");
      try {
        const createResponse = await createItem({ pasted_text: trimmed });
        setLastSavedText(trimmed);
        setTextAutosaveStatus("saved");
        const fullEntry = await getItem(createResponse.id, false);
        setItems((prev) => [fullEntry, ...prev]);
        setText("");
        setTimeout(() => textareaRef.current?.focus(), 0);
        textClearSavedStatusTimeoutRef.current = setTimeout(() => { setTextAutosaveStatus("idle"); textClearSavedStatusTimeoutRef.current = null; }, 2000);
      } catch { setTextAutosaveStatus("error"); }
    }, 700);
    return () => {
      if (textAutosaveTimeoutRef.current) clearTimeout(textAutosaveTimeoutRef.current);
      if (textClearSavedStatusTimeoutRef.current) { clearTimeout(textClearSavedStatusTimeoutRef.current); textClearSavedStatusTimeoutRef.current = null; }
    };
  }, [text, inputType, lastSavedText]);

  function getStartOfWeekSunday(now: Date): Date {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function getEndOfWeekSaturday(now: Date): Date {
    const start = getStartOfWeekSunday(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  function isWithinRange(d: Date, start: Date, end: Date): boolean {
    return d >= start && d <= end;
  }

  const now = new Date();
  const weekStart = getStartOfWeekSunday(now);
  const weekEnd = getEndOfWeekSaturday(now);
  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const weekLabel = `This week (Sun-Sat): ${dateFormatter.format(weekStart)} - ${dateFormatter.format(weekEnd)}`;

  async function fetchWithConcurrency<T, R>(items: T[], fetchFn: (item: T) => Promise<R>, maxConcurrency: number): Promise<R[]> {
    const results: R[] = [];
    const executing: Set<Promise<void>> = new Set();
    for (const item of items) {
      const promise = fetchFn(item).then((result) => {
        results.push(result);
      });
      const wrapped = promise.finally(() => executing.delete(wrapped));
      executing.add(wrapped);
      if (executing.size >= maxConcurrency) await Promise.race(executing);
    }
    await Promise.all(executing);
    return results;
  }

  const weeklyItems = items.filter((item) => isWithinRange(new Date(item.created_at), weekStart, weekEnd));
  const succeededItems = weeklyItems.filter((item) => item.status === "succeeded");
  const previousItems = items.filter(
    (item) => item.status === "succeeded" && new Date(item.created_at) < weekStart
  );
  const succeededItemsForSummary = includePreviousItems
    ? [...succeededItems, ...previousItems]
    : succeededItems;
  const succeededItemIds = succeededItemsForSummary.map((item) => item.id).join(",");
  const queuedOrProcessing = weeklyItems.filter((item) => item.status === "queued" || item.status === "processing");
  const needsTextItems = weeklyItems.filter((item) => item.status === "needs_user_text");

  useEffect(() => {
    if (succeededItemsForSummary.length === 0) return;
    const itemsNeedingSummary = succeededItemsForSummary.filter(
      (item) => !summaryById[item.id] && item.status === "succeeded"
    );
    if (itemsNeedingSummary.length === 0) return;
    setShowSummary(true);
    setHasSummarized(true);
    const loadSummaries = async () => {
      await fetchWithConcurrency(
        itemsNeedingSummary,
        async (item) => {
          try {
            setSummaryErrorById((prev) => {
              const next = { ...prev };
              delete next[item.id];
              return next;
            });
            const summary = await generateSummary(item.id);
            setSummaryById((prev) => ({ ...prev, [item.id]: summary }));
          } catch (e) {
            setSummaryErrorById((prev) => ({
              ...prev,
              [item.id]: e instanceof Error ? e.message : "Summary failed",
            }));
          }
          return null;
        },
        3
      );
    };
    void loadSummaries();
  }, [succeededItemIds]);

  function getItemDisplayTitle(item: ItemListEntry): string {
    if (item.title) return item.title;
    if (item.requested_url) {
      try { return new URL(item.requested_url).hostname.replace(/^www\./, ""); } catch { return item.requested_url; }
    }
    return "Text note";
  }

  async function handleSummarize() {
    setShowSummary(true);
    setHasSummarized(true);
    setIsSummarizing(true);
    await fetchWithConcurrency(
      succeededItemsForSummary.filter(item => !summaryById[item.id]),
      async (item) => {
        try {
          const summary = await generateSummary(item.id);
          setSummaryById((prev) => ({ ...prev, [item.id]: summary }));
        } catch (e) {
          setSummaryErrorById((prev) => ({ ...prev, [item.id]: e instanceof Error ? e.message : "Summary failed" }));
        }
        return null;
      },
      3
    );
    setIsSummarizing(false);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-14">
      <header className="mb-10">
        <h1 className="font-[var(--font-script)] text-6xl md:text-7xl leading-none tracking-tight text-black">
          Nudge
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-[var(--nudge-accent,#b3322a)]">
          For things worth coming back to.
        </p>
        <span className="mt-2 inline-block rounded border border-black/20 bg-white/30 px-2 py-0.5 text-xs font-medium text-black/70">
          {process.env.NEXT_PUBLIC_USE_MOCK_API === "true" ? "Mock API" : "Backend API"}
        </span>
      </header>

      <div className="mb-6 flex gap-2">
        <button type="button" onClick={() => setViewTab("digest")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${viewTab === "digest" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`}>
          Digest
        </button>
        <button type="button" onClick={() => setViewTab("saved")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${viewTab === "saved" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`}>
          Saved
        </button>
      </div>

      {viewTab === "digest" && (
        <section className="rounded-2xl border border-black/15 bg-white/20 p-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-black">Save as:</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setInputType("url")}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${inputType === "url" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`}>
                URL
              </button>
              <button type="button" onClick={() => setInputType("text")}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${inputType === "text" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`}>
                Text
              </button>
            </div>
          </div>
          <div className="mt-4">
            {inputType === "url" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">Article URL</label>
                <input ref={urlInputRef} value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a link (e.g., Substack, Reddit, blog post)"
                  className="w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20" />
                {autosaveStatus !== "idle" && (
                  <div className="text-xs text-black/70">
                    {autosaveStatus === "typing" && <span>Typing...</span>}
                    {autosaveStatus === "saving" && <span>Saving...</span>}
                    {autosaveStatus === "saved" && <span>Saved</span>}
                    {autosaveStatus === "error" && <span className="text-[#8b1a1a]">Error saving</span>}
                    {autosaveStatus === "invalid" && <span className="text-[#8b1a1a]">Invalid URL</span>}
                  </div>
                )}
                <p className="text-xs text-black/60">Some sites are login or paywalled; if we cannot read the link, you will see "Needs text."</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-black">Paste text</label>
                <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the content you want to save..." rows={6}
                  className="w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20" />
                {textAutosaveStatus !== "idle" && (
                  <div className="text-xs text-black/70">
                    {textAutosaveStatus === "typing" && <span>Typing...</span>}
                    {textAutosaveStatus === "saving" && <span>Saving...</span>}
                    {textAutosaveStatus === "saved" && <span>Saved</span>}
                    {textAutosaveStatus === "error" && <span className="text-[#8b1a1a]">Error saving</span>}
                  </div>
                )}
              </div>
            )}
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-black/15 bg-white/25 px-3 py-2 text-sm text-[#8b1a1a]">{error}</div>
          )}
          <div className="mt-4 flex items-center justify-end">
            <button type="button" onClick={() => refreshItems(true)} disabled={isManualRefresh}
              className="rounded-lg border border-black/20 bg-white/30 px-4 py-2 text-sm text-black hover:bg-white/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {isManualRefresh ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </section>
      )}

      {viewTab === "digest" && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between border-b border-black/15 pb-2">
            <div>
              <h2 className="text-xl font-serif font-semibold text-black">Weekly summary</h2>
              <p className="mt-1 text-xs text-black/60">{weekLabel}</p>
            </div>
            <button type="button" onClick={handleSummarize} disabled={isSummarizing || succeededItemsForSummary.length === 0}
              className="rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {isSummarizing ? "Summarizing..." : "Summarize"}
            </button>
          </div>

          {showSummary && (
            <div className="mt-4 space-y-4">
              {queuedOrProcessing.length > 0 && (
                <div className="text-sm text-black/70">Still reading {queuedOrProcessing.length} item{queuedOrProcessing.length !== 1 ? "s" : ""}...</div>
              )}
              {needsTextItems.length > 0 && (
                <div className="rounded-lg border border-black/15 bg-white/20">
                  <button type="button" onClick={() => setShowNeedsText(!showNeedsText)}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-black flex items-center justify-between">
                    <span>Fix unreadable links ({needsTextItems.length})</span>
                    <span className="text-black/60">{showNeedsText ? "-" : "+"}</span>
                  </button>
                  {showNeedsText && (
                    <div className="px-4 pb-4 space-y-3 border-t border-black/15 pt-3">
                      {needsTextItems.map((item) => (
                        <div key={item.id} className="space-y-3">
                          <div className="text-sm font-serif font-semibold text-black">{item.title ?? "(Untitled)"}</div>
                          <textarea value={fallbackTextById[item.id] || ""}
                            onChange={(e) => setFallbackTextById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Paste the text content here..." rows={4}
                            className="w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20" />
                          <button type="button" onClick={() => handleSubmitFallbackText(item.id)}
                            disabled={fallbackSubmittingById[item.id] || !fallbackTextById[item.id]?.trim()}
                            className="rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {fallbackSubmittingById[item.id] ? "Submitting..." : "Submit text"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hasSummarized && succeededItemsForSummary.length > 0 && (
                <div className="space-y-4">
                  {succeededItemsForSummary.map((item) => {
                    const summary = summaryById[item.id];
                    const summaryError = summaryErrorById[item.id];
                    const isLoading = !summary && !summaryError;
                    const lines = summary?.text?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
                    const paragraphLines: string[] = [];
                    const listLines: string[] = [];
                    for (const line of lines) {
                      if (line.startsWith("- ")) {
                        listLines.push(line.slice(2).trim());
                      } else if (listLines.length === 0) {
                        paragraphLines.push(line);
                      }
                    }
                    const paragraph = paragraphLines.join(" ");
                    return (
                      <div key={item.id} className="rounded-lg border border-black/15 bg-white/20 p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="text-sm font-serif font-semibold text-black">{getItemDisplayTitle(item)}</h3>
                          {item.requested_url && (
                            <a href={item.requested_url} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 text-xs text-black/50 hover:text-black/70 underline">source</a>
                          )}
                        </div>
                        {isLoading && <p className="text-sm text-black/50 italic">Summarizing...</p>}
                        {summaryError && <p className="text-sm text-[#8b1a1a]">{summaryError}</p>}
                        {summary && (
                          <div className="text-sm text-black/80 leading-relaxed space-y-2">
                            {paragraph && <p>{paragraph}</p>}
                            {listLines.length > 0 && (
                              <ul className="list-none space-y-1 pl-0">
                                {listLines.map((bullet, i) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="shrink-0 text-black/70">—</span>
                                    <span>{bullet}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {!paragraph && listLines.length === 0 && <p>{summary.text}</p>}
                          </div>
                        )}
                        {summary && item.requested_url && (
                          <div className="mt-3 pt-2 border-t border-black/10">
                            <a href={item.requested_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-black/50 hover:text-black/70 underline inline-flex items-center gap-1">
                              → Read original
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {previousItems.length > 0 && !includePreviousItems && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-black/60">
                  <span>You also have {previousItems.length} saved item{previousItems.length !== 1 ? "s" : ""} from previous weeks.</span>
                  <button
                    type="button"
                    onClick={() => setIncludePreviousItems(true)}
                    className="rounded border border-black/20 bg-white/30 px-2.5 py-1 text-xs font-medium text-black/80 hover:bg-white/40 transition-colors"
                  >
                    Include in digest
                  </button>
                </div>
              )}

              {succeededItems.length === 0 && queuedOrProcessing.length === 0 && needsTextItems.length === 0 && (
                <div className="rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center">
                  No items this week yet.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {viewTab === "saved" && (
        <section className="mt-8">
          <h2 className="text-xl font-serif font-semibold text-black mb-4">Saved</h2>
          {items.length === 0 ? (
            <div className="rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center">Nothing saved yet.</div>
          ) : (
            <ul className="space-y-1 rounded-lg border border-black/15 bg-white/20 divide-y divide-black/10 overflow-hidden">
              {items.map((item) => {
                const { pill } = getStatusCopy(item);
                const primaryLabel = item.requested_url?.trim() ? item.requested_url : "Text note";
                return (
                  <li key={item.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-black min-w-0 flex-1 break-all">{primaryLabel}</span>
                    <StatusPill label={pill} status={item.status} />
                    {item.status_detail && (item.status === "needs_user_text" || item.status === "failed") && (
                      <span className="w-full text-xs text-black/50 mt-0.5">{item.status_detail}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
