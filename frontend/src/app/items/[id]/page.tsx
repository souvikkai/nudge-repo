"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getItem, patchItemText } from "@/lib/itemsApi";
import type { ItemDetailResponse } from "@/lib/types";

const WORDS_PER_MINUTE = 200;

function readTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export default function ItemDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";

  const [item, setItem] = useState<ItemDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [patching, setPatching] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    setConflict(false);
    try {
      const data = await getItem(id, true);
      setItem(data);
      if (data.status === "needs_user_text" && data.content?.extracted_text) {
        setUserText(data.content.extracted_text);
      } else {
        setUserText("");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !userText.trim()) return;
    setPatching(true);
    setPatchError(null);
    setConflict(false);
    try {
      const updated = await patchItemText(id, userText.trim());
      setItem(updated);
    } catch (err) {
      const is409 =
        err instanceof Error &&
        (("status" in err && (err as Error & { status: number }).status === 409) ||
          err.message === "CONFLICT");
      if (is409) {
        setPatchError(null);
        await fetchItem();
        setConflict(true);
      } else {
        setPatchError(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setPatching(false);
    }
  }

  if (!id) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
        <p className="text-zinc-600 dark:text-zinc-400">Missing item ID.</p>
        <Link href="/items" className="mt-4 inline-block text-sm text-zinc-900 dark:text-zinc-100 underline">
          Back to items
        </Link>
      </div>
    );
  }

  if (loading && !item) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
          </div>
          <Link href="/items" className="mt-4 inline-block text-sm text-zinc-600 dark:text-zinc-400 underline">
            Back to items
          </Link>
        </div>
      </div>
    );
  }

  if (fetchError && !item) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {fetchError}
          </div>
          <Link href="/items" className="mt-4 inline-block text-sm text-zinc-600 dark:text-zinc-400 underline">
            Back to items
          </Link>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const { status, title, requested_url, status_detail, content } = item;

  if (status === "queued" || status === "processing") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              {status === "queued" ? "Queued" : "Processing"}…
            </p>
          </div>
          <Link href="/items" className="mt-4 inline-block text-sm text-zinc-600 dark:text-zinc-400 underline">
            Back to items
          </Link>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-6">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Error</h2>
            {status_detail && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{status_detail}</p>}
          </div>
          <Link href="/items" className="mt-4 inline-block text-sm text-zinc-600 dark:text-zinc-400 underline">
            Back to items
          </Link>
        </div>
      </div>
    );
  }

  if (status === "succeeded") {
    const canonical = content?.canonical_text ?? "";
    const minutes = readTimeMinutes(canonical);

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/items" className="text-sm text-zinc-600 dark:text-zinc-400 underline">
              Back to items
            </Link>
          </div>
          {title && (
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
          )}
          {requested_url && (
            <p className="mb-4 truncate text-sm text-zinc-500 dark:text-zinc-400">{requested_url}</p>
          )}
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            {minutes} min read
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            <div className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
              {canonical || "—"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "needs_user_text") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/items" className="text-sm text-zinc-600 dark:text-zinc-400 underline">
              Back to items
            </Link>
          </div>
          {title && (
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
          )}
          {requested_url && (
            <p className="mb-4 truncate text-sm text-zinc-500 dark:text-zinc-400">{requested_url}</p>
          )}
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Paste or edit the text below, then submit.
          </p>

          {conflict && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              Item was updated elsewhere. Refreshed.
            </div>
          )}
          {patchError && !conflict && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {patchError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="Paste or edit text…"
              rows={14}
              className="mb-4 w-full resize-y rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              required
            />
            <button
              type="submit"
              disabled={patching}
              className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {patching ? "Saving…" : "Submit"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
