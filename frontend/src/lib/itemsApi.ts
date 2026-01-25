import type { Item, ItemContent, ItemDetailResponse, ItemInputType, ItemStatus } from "./types";

const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

// ---- Requests ----
export type CreateItemRequest =
  | { input_type: "url"; input_url: string }
  | { input_type: "text"; user_pasted_text: string };

export type PatchItemTextRequest = { user_pasted_text: string };

// ---- Helpers ----
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`);
  }

  return res.json() as Promise<T>;
}

function isoNow() {
  return new Date().toISOString();
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ---- Mock data: list is metadata-only; content is stored separately ----
const mockItems: Item[] = [
  {
    id: "1",
    status: "succeeded",
    input_type: "url" as ItemInputType,
    input_url: "https://example.com/article",
    title: "Example Article",
    source: "example.com",
    created_at: "2026-01-23T10:00:00Z",
    updated_at: "2026-01-23T10:05:00Z",
  },
  {
    id: "2",
    status: "processing",
    input_type: "url" as ItemInputType,
    input_url: "https://example.com/another",
    title: null,
    source: "example.com",
    created_at: "2026-01-23T10:10:00Z",
    updated_at: "2026-01-23T10:10:00Z",
  },
  {
    id: "3",
    status: "needs_user_text",
    input_type: "url" as ItemInputType,
    input_url: "https://example.com/needs-text",
    title: "Article Needs Text",
    source: "example.com",
    error_code: "EXTRACTION_FAILED",
    error_detail: "Could not extract readable text; please paste it.",
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
  "3": null, // needs user text
};

// ---- API functions ----

// POST /items
export async function createItem(data: CreateItemRequest): Promise<Item> {
  if (USE_MOCK_API) {
    await delay(300);

    const id = randomId();
    const now = isoNow();

    const isText = data.input_type === "text";

    const item: Item = {
      id,
      status: isText ? ("succeeded" as ItemStatus) : ("queued" as ItemStatus),
      input_type: data.input_type,
      input_url: data.input_type === "url" ? data.input_url : undefined,
      title: null,
      source: data.input_type === "url" ? (domainFromUrl(data.input_url) ?? "unknown") : "pasted_text",
      created_at: now,
      updated_at: now,
    };

    mockItems.unshift(item);

    if (isText) {
      mockContentById[id] = {
        canonical_text: data.user_pasted_text,
        user_pasted_text: data.user_pasted_text,
      };
    } else {
      mockContentById[id] = null;

      // simulate async lifecycle
      setTimeout(() => {
        const idx = mockItems.findIndex((x) => x.id === id);
        if (idx >= 0) mockItems[idx] = { ...mockItems[idx], status: "processing", updated_at: isoNow() };
      }, 300);

      setTimeout(() => {
        const ok = Math.random() < 0.75;
        const idx = mockItems.findIndex((x) => x.id === id);
        if (idx < 0) return;

        if (ok) {
          mockItems[idx] = { ...mockItems[idx], status: "succeeded", updated_at: isoNow() };
          mockContentById[id] = {
            canonical_text: "Mock canonical_text from extracted content.",
            extracted_text: "Mock extracted_text.",
          };
        } else {
          mockItems[idx] = {
            ...mockItems[idx],
            status: "needs_user_text",
            error_code: "EXTRACTION_FAILED",
            error_detail: "Could not extract readable text; please paste it.",
            updated_at: isoNow(),
          };
          mockContentById[id] = null;
        }
      }, 1400);
    }

    return item;
  }

  return apiFetch<Item>("/items", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// GET /items
export async function listItems(): Promise<Item[]> {
  if (USE_MOCK_API) {
    await delay(200);
    return mockItems;
  }

  return apiFetch<Item[]>("/items", { method: "GET" });
}

// GET /items/{id}?include_content=true
export async function getItem(id: string, includeContent = true): Promise<ItemDetailResponse> {
  if (USE_MOCK_API) {
    await delay(200);

    const item = mockItems.find((x) => x.id === id);
    if (!item) throw new Error(`Item ${id} not found`);

    return {
      item,
      content: includeContent ? (mockContentById[id] ?? null) : null,
    };
  }

  const qs = includeContent ? "?include_content=true" : "";
  return apiFetch<ItemDetailResponse>(`/items/${id}${qs}`, { method: "GET" });
}

// PATCH /items/{id}/text
export async function patchItemText(id: string, text: string): Promise<ItemDetailResponse> {
  if (USE_MOCK_API) {
    await delay(300);

    const idx = mockItems.findIndex((x) => x.id === id);
    if (idx < 0) throw new Error(`Item ${id} not found`);

    const item = mockItems[idx];
    if (item.status !== "needs_user_text") {
      const e = new Error("CONFLICT") as Error & { status?: number };
      e.status = 409;
      throw e;
    }

    const updated: Item = {
      ...item,
      status: "succeeded",
      error_code: undefined,
      error_detail: undefined,
      updated_at: isoNow(),
    };

    mockItems[idx] = updated;
    mockContentById[id] = {
      canonical_text: text,
      user_pasted_text: text,
    };

    return { item: updated, content: mockContentById[id] };
  }

  return apiFetch<ItemDetailResponse>(`/items/${id}/text`, {
    method: "PATCH",
    body: JSON.stringify({ user_pasted_text: text }),
  });
}

