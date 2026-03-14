"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listItems } from "@/lib/itemsApi";
import type { ItemListEntry, ItemStatus } from "@/lib/types";

function StatusPill({ status }: { status: ItemStatus }) {
  const styles = {
    queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    succeeded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    needs_user_text: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status]
      }`}
    >
      {status}
    </span>
  );
}

export default function ItemsPage() {
  const [items, setItems] = useState<ItemListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const response = await listItems();
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Items
          </h1>
          <div className="flex gap-3">
            <button
              onClick={fetchItems}
              disabled={loading}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link
              href="/"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              New item
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            Loading items…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">No items found.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/items/${item.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <StatusPill status={item.status} />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.source_type === "pasted_text" ? "text" : "url"}
                      </span>
                    </div>
                    {item.title ? (
                      <h2 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h2>
                    ) : null}
                    {item.requested_url ? (
                      <p className="mb-2 truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {item.requested_url}
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>ID: {item.id}</span>
                      <span>Created: {formatDate(item.created_at)}</span>
                    </div>
                    {item.status_detail && (
                      <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {item.status_detail}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
