import type {
  ItemContent,
  ItemCreateResponse,
  ItemDetailResponse,
  ItemListEntry,
  ItemListResponse,
  ItemStatus,
  SourceType,
} from "./types";

const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

// ---- Helpers ----
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const fullUrl = `${API_BASE_URL}${path}`;
  const method = (init?.method as string) || "GET";
  console.log("[apiFetch]", method, fullUrl);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (error) {
    console.error("[apiFetch failed]", fullUrl, error);
    throw error;
  }

  if (!res.ok) {
    let message: string;
    const raw = await res.text().catch(() => "");
    try {
      const json = JSON.parse(raw) as { detail?: string | { msg?: string }[] };
      if (typeof json.detail === "string") {
        message = json.detail;
      } else if (Array.isArray(json.detail) && json.detail[0]?.msg) {
        message = json.detail.map((d) => d.msg).join("; ");
      } else {
        message = raw || `${res.status} ${res.statusText}`;
      }
    } catch {
      message = raw || `${res.status} ${res.statusText}`;
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

function isoNow() {
  return new Date().toISOString();
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Mock data ----
const mockEntries: ItemListEntry[] = [
  {
    id: "1",
    status: "succeeded",
    status_detail: null,
    source_type: "url",
    requested_url: "https://example.com/article",
    final_text_source: "example.com",
    title: "Example Article",
    created_at: "2026-01-23T10:00:00Z",
    updated_at: "2026-01-23T10:05:00Z",
  },
  {
    id: "2",
    status: "processing",
    status_detail: null,
    source_type: "url",
    requested_url: "https://example.com/another",
    final_text_source: null,
    title: null,
    created_at: "2026-01-23T10:10:00Z",
    updated_at: "2026-01-23T10:10:00Z",
  },
  {
    id: "3",
    status: "needs_user_text",
    status_detail: "Could not extract readable text; please paste it.",
    source_type: "url",
    requested_url: "https://example.com/needs-text",
    final_text_source: null,
    title: "Article Needs Text",
    created_at: "2026-01-23T10:15:00Z",
    updated_at: "2026-01-23T10:20:00Z",
  },
];

const mockContentById: Record<string, ItemContent | null> = {
  "1": {
    canonical_text: "This is the canonical text from the article.",
    extracted_text: "This is the extracted text from the article.",
  },
  "2": null,
  "3": null,
};

// ---- API functions ----

/** POST /items — returns only { id, status }. Body: url?, pasted_text?, prefer_pasted_text. At least one of url or pasted_text required. */
export async function createItem(params: {
  url?: string;
  pasted_text?: string;
  prefer_pasted_text?: boolean;
}): Promise<ItemCreateResponse> {
  const { url, pasted_text, prefer_pasted_text = false } = params;
  const hasUrl = url != null && String(url).trim() !== "";
  const hasPasted = pasted_text != null && String(pasted_text).trim() !== "";
  if (!hasUrl && !hasPasted) {
    throw new Error("Provide at least one of url or pasted_text.");
  }

  if (USE_MOCK_API) {
    await delay(300);
    const id = randomId();
    const now = isoNow();
    const isPasted = hasPasted && (prefer_pasted_text || !hasUrl);

    const entry: ItemListEntry = {
      id,
      status: isPasted ? ("succeeded" as ItemStatus) : ("queued" as ItemStatus),
      status_detail: null,
      source_type: isPasted ? "pasted_text" : "url",
      requested_url: hasUrl ? url!.trim() : null,
      final_text_source: isPasted ? "pasted_text" : null,
      title: null,
      created_at: now,
      updated_at: now,
    };
    mockEntries.unshift(entry);

    if (isPasted) {
      mockContentById[id] = {
        canonical_text: pasted_text!.trim(),
        user_pasted_text: pasted_text!.trim(),
      };
    } else {
      mockContentById[id] = null;
      setTimeout(() => {
        const idx = mockEntries.findIndex((x) => x.id === id);
        if (idx >= 0) mockEntries[idx] = { ...mockEntries[idx], status: "processing", updated_at: isoNow() };
      }, 300);
      setTimeout(() => {
        const ok = Math.random() < 0.75;
        const idx = mockEntries.findIndex((x) => x.id === id);
        if (idx < 0) return;
        if (ok) {
          mockEntries[idx] = {
            ...mockEntries[idx],
            status: "succeeded",
            final_text_source: "example.com",
            updated_at: isoNow(),
          };
          mockContentById[id] = {
            canonical_text: "Mock canonical text.",
            extracted_text: "Mock extracted text.",
          };
        } else {
          mockEntries[idx] = {
            ...mockEntries[idx],
            status: "needs_user_text",
            status_detail: "Could not extract readable text; please paste it.",
            updated_at: isoNow(),
          };
          mockContentById[id] = null;
        }
      }, 1400);
    }

    return { id, status: entry.status };
  }

  const body = {
    url: hasUrl ? url!.trim() : undefined,
    pasted_text: hasPasted ? pasted_text!.trim() : undefined,
    prefer_pasted_text: prefer_pasted_text ?? false,
  };
  return apiFetch<ItemCreateResponse>("/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** GET /items — returns { items, next_cursor? }. Optional limit and cursor. */
export async function listItems(params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<ItemListResponse> {
  if (USE_MOCK_API) {
    await delay(200);
    return { items: mockEntries, next_cursor: null };
  }

  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.cursor != null && params.cursor !== "") search.set("cursor", params.cursor);
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ItemListResponse>(`/items${qs}`, { method: "GET" });
}

/** GET /items/{id} — returns single ItemDetailResponse. include_content defaults false. */
export async function getItem(id: string, includeContent = false): Promise<ItemDetailResponse> {
  if (USE_MOCK_API) {
    await delay(200);
    const entry = mockEntries.find((x) => x.id === id);
    if (!entry) {
      const err = new Error(`Item ${id} not found`) as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    const content = includeContent ? (mockContentById[id] ?? null) : null;
    return { ...entry, content };
  }

  const qs = includeContent ? "?include_content=true" : "?include_content=false";
  return apiFetch<ItemDetailResponse>(`/items/${id}${qs}`, { method: "GET" });
}

/** PATCH /items/{id} — body { pasted_text }. Returns single ItemDetailResponse. */
export async function patchItemText(id: string, pasted_text: string): Promise<ItemDetailResponse> {
  if (USE_MOCK_API) {
    await delay(300);
    const idx = mockEntries.findIndex((x) => x.id === id);
    if (idx < 0) {
      const err = new Error(`Item ${id} not found`) as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    const entry = mockEntries[idx];
    if (entry.status !== "needs_user_text") {
      const e = new Error("CONFLICT") as Error & { status?: number };
      e.status = 409;
      throw e;
    }
    const updated: ItemListEntry = {
      ...entry,
      status: "succeeded",
      status_detail: null,
      updated_at: isoNow(),
    };
    mockEntries[idx] = updated;
    mockContentById[id] = { canonical_text: pasted_text, user_pasted_text: pasted_text };
    return { ...updated, content: mockContentById[id] };
  }

  return apiFetch<ItemDetailResponse>(`/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ pasted_text }),
  });
}
