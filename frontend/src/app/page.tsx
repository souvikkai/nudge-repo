"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemDetailResponse, ItemListEntry, ItemStatus, SourceType } from "@/lib/types";
import { createItem, getItem, listItems, patchItemText } from "@/lib/itemsApi";

type AutosaveStatus = "idle" | "typing" | "saving" | "saved" | "error" | "invalid";

function getStatusCopy(item: ItemListEntry): {
  pill: string;
  subtitle: string;
  debug?: string;
} {
  const { status, status_detail } = item;
  switch (status) {
    case "queued":
      return {
        pill: "Queued",
        subtitle: "In line to read this…",
        debug: status_detail || undefined,
      };
    case "processing":
      return {
        pill: "Reading…",
        subtitle: "Pulling the best text from the link…",
        debug: status_detail || undefined,
      };
    case "succeeded":
      return {
        pill: "Ready",
        subtitle: "Saved for your next review.",
        debug: status_detail || undefined,
      };
    case "needs_user_text":
      return {
        pill: "Needs text",
        subtitle: "Can't access this link. Paste the text and we'll save it.",
        debug: status_detail || undefined,
      };
    case "failed":
      return {
        pill: "Failed",
        subtitle: "We couldn't save this. Try again or paste the text.",
        debug: status_detail || undefined,
      };
    default:
      return {
        pill: status,
        subtitle: "",
        debug: status_detail || undefined,
      };
  }
}

function StatusPill({ label, status }: { label: string; status: ItemStatus }) {
  const statusStyles = useMemo(() => {
    switch (status) {
      case "succeeded":
        return "bg-white/30 text-black border-black/20";
      case "needs_user_text":
        return "bg-white/35 text-black border-black/25";
      case "queued":
      case "processing":
        return "bg-white/20 text-black/80 border-black/15";
      case "failed":
        return "bg-white/30 text-[#8b1a1a] border-[#8b1a1a]/30";
      default:
        return "bg-white/20 text-black/80 border-black/15";
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

  // Fallback text submission state
  const [fallbackTextById, setFallbackTextById] = useState<Record<string, string>>({});
  const [fallbackSubmittingById, setFallbackSubmittingById] = useState<Record<string, boolean>>({});

  // View tab: Digest (weekly summary) vs Saved (all items list)
  const [viewTab, setViewTab] = useState<"digest" | "saved">("digest");

  // Weekly summary state
  const [showSummary, setShowSummary] = useState(false);
  const [showNeedsText, setShowNeedsText] = useState(false);
  const [hasSummarized, setHasSummarized] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [weeklyDetailsById, setWeeklyDetailsById] = useState<Record<string, ItemDetailResponse>>({});

  // Autosave state for URL mode
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedUrl, setLastSavedUrl] = useState<string>("");
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSavedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave state for text mode
  const [textAutosaveStatus, setTextAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedText, setLastSavedText] = useState<string>("");
  const textAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textClearSavedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Polling interval ref
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for clearing + refocus after successful autosave
  const urlInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshItems = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsManualRefresh(true);
    }
    try {
      const response = await listItems();
      setItems(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load items");
    } finally {
      if (isManual) {
        setIsManualRefresh(false);
      }
    }
  }, []);

  async function handleSubmitFallbackText(itemId: string) {
    const text = fallbackTextById[itemId]?.trim();
    
    if (!text) {
      setError("Please paste text before submitting.");
      return;
    }

    setFallbackSubmittingById((prev) => ({ ...prev, [itemId]: true }));
    setError(null);

    try {
      await patchItemText(itemId, text);
      // Clear the text entry
      setFallbackTextById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      // Refresh items to show updated status
      await refreshItems();
      
      // If user has already summarized, fetch details for any newly succeeded items
      if (hasSummarized) {
        // Get fresh items list after refresh
        const freshResponse = await listItems();
        const now = new Date();
        const weekStart = getStartOfWeekSunday(now);
        const weekEnd = getEndOfWeekSaturday(now);
        
        // Recalculate weekly items after refresh
        const updatedWeeklyItems = freshResponse.items.filter((item) => {
          const itemDate = new Date(item.created_at);
          return isWithinRange(itemDate, weekStart, weekEnd);
        });
        
        const newlySucceeded = updatedWeeklyItems.filter(
          (item) => item.status === "succeeded" && !weeklyDetailsById[item.id]
        );
        
        if (newlySucceeded.length > 0) {
          const details = await fetchWithConcurrency(
            newlySucceeded,
            (item) => getItem(item.id, true),
            3
          );
          
          setWeeklyDetailsById((prev) => {
            const next = { ...prev };
            for (const detail of details) {
              next[detail.id] = detail;
            }
            return next;
          });
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
      setFallbackSubmittingById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  // Polling: refresh items when any are queued or processing
  useEffect(() => {
    const hasInProgress = items.some(
      (item) => item.status === "queued" || item.status === "processing"
    );

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Start polling if there are items in progress
    if (hasInProgress) {
      pollingIntervalRef.current = setInterval(() => {
        refreshItems();
      }, 1500);
    }

    // Cleanup on unmount or when items change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [items, refreshItems]);

  // URL autosave with debouncing
  useEffect(() => {
    // Only autosave in URL mode
    if (inputType !== "url") {
      setAutosaveStatus("idle");
      return;
    }

    const trimmed = url.trim();

    // Clear existing timeouts
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    if (clearSavedStatusTimeoutRef.current) {
      clearTimeout(clearSavedStatusTimeoutRef.current);
      clearSavedStatusTimeoutRef.current = null;
    }

    // If empty, reset to idle
    if (!trimmed) {
      setAutosaveStatus("idle");
      return;
    }

    // Validate URL
    let isValidUrl = false;
    try {
      new URL(trimmed);
      isValidUrl = true;
    } catch {
      isValidUrl = false;
    }

    if (!isValidUrl) {
      setAutosaveStatus("invalid");
      return;
    }

    // Dedupe: show saved if same as last saved
    if (trimmed === lastSavedUrl) {
      setAutosaveStatus("saved");
      return;
    }

    // Set typing status immediately
    setAutosaveStatus("typing");

    // Debounce: wait 700ms before saving
    autosaveTimeoutRef.current = setTimeout(async () => {
      setAutosaveStatus("saving");
      try {
        const createResponse = await createItem({ url: trimmed });
        setLastSavedUrl(trimmed);
        setAutosaveStatus("saved");
        // Fetch full entry and insert into list
        const fullEntry = await getItem(createResponse.id, false);
        setItems((prev) => [fullEntry, ...prev]);
        setUrl("");
        setTimeout(() => urlInputRef.current?.focus(), 0);
        // Clear saved status after 2 seconds
        clearSavedStatusTimeoutRef.current = setTimeout(() => {
          setAutosaveStatus("idle");
          clearSavedStatusTimeoutRef.current = null;
        }, 2000);
      } catch (e) {
        setAutosaveStatus("error");
        // Keep error status visible
      }
    }, 700);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      if (clearSavedStatusTimeoutRef.current) {
        clearTimeout(clearSavedStatusTimeoutRef.current);
        clearSavedStatusTimeoutRef.current = null;
      }
    };
  }, [url, inputType, lastSavedUrl, refreshItems]);

  // Text autosave with debouncing
  useEffect(() => {
    // Only autosave in text mode
    if (inputType !== "text") {
      setTextAutosaveStatus("idle");
      return;
    }

    const trimmed = text.trim();

    // Clear existing timeouts
    if (textAutosaveTimeoutRef.current) {
      clearTimeout(textAutosaveTimeoutRef.current);
    }
    if (textClearSavedStatusTimeoutRef.current) {
      clearTimeout(textClearSavedStatusTimeoutRef.current);
      textClearSavedStatusTimeoutRef.current = null;
    }

    // If empty, reset to idle
    if (!trimmed) {
      setTextAutosaveStatus("idle");
      return;
    }

    // Dedupe: show saved if same as last saved
    if (trimmed === lastSavedText) {
      setTextAutosaveStatus("saved");
      return;
    }

    // Set typing status immediately
    setTextAutosaveStatus("typing");

    // Debounce: wait 700ms before saving
    textAutosaveTimeoutRef.current = setTimeout(async () => {
      setTextAutosaveStatus("saving");
      try {
        const createResponse = await createItem({ pasted_text: trimmed });
        setLastSavedText(trimmed);
        setTextAutosaveStatus("saved");
        // Fetch full entry and insert into list
        const fullEntry = await getItem(createResponse.id, false);
        setItems((prev) => [fullEntry, ...prev]);
        setText("");
        setTimeout(() => textareaRef.current?.focus(), 0);
        // Clear saved status after 2 seconds
        textClearSavedStatusTimeoutRef.current = setTimeout(() => {
          setTextAutosaveStatus("idle");
          textClearSavedStatusTimeoutRef.current = null;
        }, 2000);
      } catch (e) {
        setTextAutosaveStatus("error");
        // Keep error status visible
      }
    }, 700);

    return () => {
      if (textAutosaveTimeoutRef.current) {
        clearTimeout(textAutosaveTimeoutRef.current);
      }
      if (textClearSavedStatusTimeoutRef.current) {
        clearTimeout(textClearSavedStatusTimeoutRef.current);
        textClearSavedStatusTimeoutRef.current = null;
      }
    };
  }, [text, inputType, lastSavedText, refreshItems]);

  // Calendar week definition: Sunday–Saturday (local time)
  // Helper functions for week filtering
  function getStartOfWeekSunday(now: Date): Date {
    const day = now.getDay(); // Sunday = 0
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

  // Calculate current week range and format label
  const now = new Date();
  const weekStart = getStartOfWeekSunday(now);
  const weekEnd = getEndOfWeekSaturday(now);
  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const weekLabel = `This week (Sun–Sat): ${dateFormatter.format(weekStart)} – ${dateFormatter.format(weekEnd)}`;

  // Filter items by current week
  const weeklyItems = items.filter((item) => {
    const itemDate = new Date(item.created_at);
    return isWithinRange(itemDate, weekStart, weekEnd);
  });

  const succeededItems = weeklyItems.filter((item) => item.status === "succeeded");
  const queuedOrProcessing = weeklyItems.filter(
    (item) => item.status === "queued" || item.status === "processing"
  );
  const needsTextItems = weeklyItems.filter((item) => item.status === "needs_user_text");

  // Promise pool helper for concurrency control
  async function fetchWithConcurrency<T>(
    items: T[],
    fetchFn: (item: T) => Promise<ItemDetailResponse>,
    maxConcurrency: number
  ): Promise<ItemDetailResponse[]> {
    const results: ItemDetailResponse[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (const item of items) {
      const promise = fetchFn(item).then((result) => {
        results.push(result);
      });

      const wrappedPromise = promise.finally(() => {
        executing.delete(wrappedPromise);
      });

      executing.add(wrappedPromise);

      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  // Extract text from item detail for summary (preference: canonical_text > user_pasted_text > extracted_text > title)
  function getItemText(detail: ItemDetailResponse): string {
    if (detail.content?.canonical_text) {
      return detail.content.canonical_text;
    }
    if (detail.content?.user_pasted_text) {
      return detail.content.user_pasted_text;
    }
    if (detail.content?.extracted_text) {
      return detail.content.extracted_text;
    }
    return detail.title || "";
  }

  // For Saved list: normalized hostname or requested_url truncated
  function getSavedRowSource(item: ItemListEntry): string {
    if (!item.requested_url) return "";
    try {
      const u = new URL(item.requested_url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      const s = item.requested_url;
      return s.length > 48 ? s.slice(0, 48) + "…" : s;
    }
  }

  // Normalize URL for display
  function normalizeUrlForDisplay(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.hostname = parsed.hostname.toLowerCase();
      parsed.hash = "";
      if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  // Dedupe strings array
  function dedupeStrings(arr: string[]): string[] {
    return Array.from(new Set(arr));
  }

  // Get topic label from item
  function getTopicLabel(item: ItemListEntry): string {
    if (item.title) {
      const stopwords = new Set(["a", "an", "the", "and", "of", "to", "for", "in", "on", "with", "from", "by"]);
      const words = item.title
        .split(/\s+/)
        .filter((w) => {
          const cleaned = w.replace(/[^\w]/g, "").toLowerCase();
          return cleaned.length > 0 && !stopwords.has(cleaned);
        })
        .slice(0, 4);
      
      if (words.length >= 2) {
        return words
          .map((w) => {
            const cleaned = w.replace(/[^\w]/g, "");
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
          })
          .join(" ");
      }
    }
    
    if (item.requested_url) {
      try {
        const url = new URL(item.requested_url);
        let hostname = url.hostname.replace(/^www\./, "");
        const parts = hostname.split(".");
        const domain = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        return domain.charAt(0).toUpperCase() + domain.slice(1);
      } catch {
        return "Misc";
      }
    }
    
    return "Misc";
  }

  // Generate bullets from combined text (simple heuristic)
  function generateBullets(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    
    // Split by sentences (rough heuristic)
    const sentences = trimmed
      .split(/[.!?]+\s+/)
      .filter((s) => s.trim().length > 20)
      .slice(0, 4);
    
    if (sentences.length >= 2) {
      return sentences.map((s) => s.trim()).slice(0, 4);
    }
    
    // If too few sentences, split by length
    if (trimmed.length > 200) {
      const chunkSize = Math.ceil(trimmed.length / 3);
      const bullets: string[] = [];
      for (let i = 0; i < trimmed.length; i += chunkSize) {
        bullets.push(trimmed.slice(i, i + chunkSize).trim());
        if (bullets.length >= 3) break;
      }
      return bullets.filter((b) => b.length > 0);
    }
    
    return trimmed.length > 100 ? [trimmed.slice(0, 150) + "..."] : [trimmed];
  }

  async function handleSummarize() {
    setShowSummary(true);
    setHasSummarized(true);
    setIsSummarizing(true);

    try {
      const succeededToFetch = succeededItems;
      const details = await fetchWithConcurrency(
        succeededToFetch,
        (item) => getItem(item.id, true),
        3
      );

      const detailsMap: Record<string, ItemDetailResponse> = {};
      for (const detail of details) {
        detailsMap[detail.id] = detail;
      }
      setWeeklyDetailsById(detailsMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch item details");
    } finally {
      setIsSummarizing(false);
    }
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
        <button
          type="button"
          onClick={() => setViewTab("digest")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            viewTab === "digest"
              ? "bg-black text-[var(--nudge-bg)] border-black"
              : "bg-white/30 text-black border-black/20 hover:bg-white/40"
          }`}
        >
          Digest
        </button>
        <button
          type="button"
          onClick={() => setViewTab("saved")}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            viewTab === "saved"
              ? "bg-black text-[var(--nudge-bg)] border-black"
              : "bg-white/30 text-black border-black/20 hover:bg-white/40"
          }`}
        >
          Saved
        </button>
      </div>

      {viewTab === "digest" && (
      <section className="rounded-2xl border border-black/15 bg-white/20 p-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-black">Save as:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInputType("url")}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                inputType === "url"
                  ? "bg-black text-[var(--nudge-bg)] border-black"
                  : "bg-white/30 text-black border-black/20 hover:bg-white/40"
              }`}
            >
              URL
            </button>
            <button
              type="button"
              onClick={() => setInputType("text")}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                inputType === "text"
                  ? "bg-black text-[var(--nudge-bg)] border-black"
                  : "bg-white/30 text-black border-black/20 hover:bg-white/40"
              }`}
            >
              Text
            </button>
          </div>
        </div>

        <div className="mt-4">
          {inputType === "url" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Article URL</label>
              <input
                ref={urlInputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a link (e.g., Substack, Reddit, blog post)"
                className="w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
              />
              {autosaveStatus !== "idle" && (
                <div className="text-xs text-black/70">
                  {autosaveStatus === "typing" && <span>Typing...</span>}
                  {autosaveStatus === "saving" && <span>Saving...</span>}
                  {autosaveStatus === "saved" && <span>Saved</span>}
                  {autosaveStatus === "error" && <span className="text-[#8b1a1a]">Error saving</span>}
                  {autosaveStatus === "invalid" && <span className="text-[#8b1a1a]">Invalid URL</span>}
                </div>
              )}
              <p className="text-xs text-black/60">
                Some sites are login or paywalled; if we can't read the link, you'll see "Needs text."
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Paste text</label>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the content you want to save..."
                rows={6}
                className="w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
              />
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
          <div className="mt-4 rounded-lg border border-black/15 bg-white/25 px-3 py-2 text-sm text-[#8b1a1a]">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={() => refreshItems(true)}
            disabled={isManualRefresh}
            className="rounded-lg border border-black/20 bg-white/30 px-4 py-2 text-sm text-black hover:bg-white/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
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
          <button
            type="button"
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isSummarizing ? "Summarizing..." : "Summarize"}
          </button>
        </div>

        {showSummary && (
          <div className="mt-4 space-y-4">
            {isSummarizing && (
              <div className="text-sm text-black/70">Summarizing…</div>
            )}
            {queuedOrProcessing.length > 0 && (
              <div className="text-sm text-black/70">
                Still reading {queuedOrProcessing.length} item{queuedOrProcessing.length !== 1 ? "s" : ""}…
              </div>
            )}

            {needsTextItems.length > 0 && (
              <div className="rounded-lg border border-black/15 bg-white/20">
                <button
                  type="button"
                  onClick={() => setShowNeedsText(!showNeedsText)}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-black flex items-center justify-between"
                >
                  <span>Fix unreadable links ({needsTextItems.length})</span>
                  <span className="text-black/60">{showNeedsText ? "−" : "+"}</span>
                </button>
                {showNeedsText && (
                  <div className="px-4 pb-4 space-y-3 border-t border-black/15 pt-3">
                    {needsTextItems.map((item) => (
                      <div key={item.id} className="space-y-3">
                        <div className="text-sm font-serif font-semibold text-black">
                          {item.title ?? "(Untitled)"}
                        </div>
                        <textarea
                          value={fallbackTextById[item.id] || ""}
                          onChange={(e) =>
                            setFallbackTextById((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="Paste the text content here..."
                          rows={4}
                          className="w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitFallbackText(item.id)}
                          disabled={fallbackSubmittingById[item.id] || !fallbackTextById[item.id]?.trim()}
                          className="rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {fallbackSubmittingById[item.id] ? "Submitting..." : "Submit text"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasSummarized && !isSummarizing && succeededItems.length > 0 && (() => {
              // Group succeeded items by topic
              const itemsByTopic = new Map<string, ItemListEntry[]>();
              for (const item of succeededItems) {
                const topic = getTopicLabel(item);
                if (!itemsByTopic.has(topic)) {
                  itemsByTopic.set(topic, []);
                }
                itemsByTopic.get(topic)!.push(item);
              }

              return (
                <div className="space-y-6">
                  {Array.from(itemsByTopic.entries()).map(([topic, topicItems]) => {
                    // Combine text from all items in this topic
                    const combinedText = topicItems
                      .map((item) => {
                        const detail = weeklyDetailsById[item.id];
                        return detail ? getItemText(detail) : "";
                      })
                      .filter((text) => text.length > 0)
                      .join(" ");

                    const bullets = generateBullets(combinedText);
                    
                    // Collect and normalize URLs
                    const urls = topicItems
                      .map((item) => item.requested_url)
                      .filter((url): url is string => url != null && url !== "")
                      .map(normalizeUrlForDisplay);
                    const uniqueUrls = dedupeStrings(urls);

                    return (
                      <div key={topic} className="rounded-lg border border-black/15 bg-white/20 p-4">
                        <h3 className="text-lg font-serif font-semibold text-black mb-2">Topic: {topic}</h3>
                        <div className="mb-3">
                          <div className="text-sm font-medium text-black/80 mb-1">Summary:</div>
                          <ul className="list-disc list-inside space-y-1 text-sm text-black/70 ml-2">
                            {bullets.map((bullet, idx) => (
                              <li key={idx}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                        {uniqueUrls.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-black/80 mb-1">Sources:</div>
                            <ul className="list-disc list-inside space-y-1 text-sm text-black/70 ml-2">
                              {uniqueUrls.map((url, idx) => (
                                <li key={idx}>{url}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {!hasSummarized && succeededItems.length > 0 && (
              <div className="rounded-lg border border-black/15 bg-white/20 p-4">
                <p className="text-sm text-black/70">
                  {succeededItems.length} item{succeededItems.length !== 1 ? "s" : ""} ready to review.
                </p>
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
            <div className="rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center">
              Nothing saved yet.
            </div>
          ) : (
            <ul className="space-y-1 rounded-lg border border-black/15 bg-white/20 divide-y divide-black/10 overflow-hidden">
              {items.map((item) => {
                const { pill } = getStatusCopy(item);
                const primaryLabel = item.requested_url?.trim()
                  ? item.requested_url
                  : "Text note";
                return (
                  <li key={item.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-black min-w-0 flex-1 break-all">
                      {primaryLabel}
                    </span>
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
