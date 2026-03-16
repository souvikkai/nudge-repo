module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/src/lib/itemsApi.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createItem",
    ()=>createItem,
    "generateSummary",
    ()=>generateSummary,
    "getItem",
    ()=>getItem,
    "listItems",
    ()=>listItems,
    "patchItemText",
    ()=>patchItemText
]);
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
// ---- Helpers ----
const delay = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
async function apiFetch(path, init) {
    const fullUrl = `${API_BASE_URL}${path}`;
    const method = init?.method || "GET";
    console.log("[apiFetch]", method, fullUrl);
    let res;
    try {
        res = await fetch(fullUrl, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...init?.headers || {}
            }
        });
    } catch (error) {
        console.error("[apiFetch failed]", fullUrl, error);
        throw error;
    }
    if (!res.ok) {
        let message;
        const raw = await res.text().catch(()=>"");
        try {
            const json = JSON.parse(raw);
            if (typeof json.detail === "string") {
                message = json.detail;
            } else if (Array.isArray(json.detail) && json.detail[0]?.msg) {
                message = json.detail.map((d)=>d.msg).join("; ");
            } else {
                message = raw || `${res.status} ${res.statusText}`;
            }
        } catch  {
            message = raw || `${res.status} ${res.statusText}`;
        }
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }
    return res.json();
}
// Reads a plain-text response body (used by the summary endpoint)
async function apiFetchText(path, init) {
    const fullUrl = `${API_BASE_URL}${path}`;
    const method = init?.method || "POST";
    console.log("[apiFetchText]", method, fullUrl);
    let res;
    try {
        res = await fetch(fullUrl, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...init?.headers || {}
            }
        });
    } catch (error) {
        console.error("[apiFetchText failed]", fullUrl, error);
        throw error;
    }
    if (!res.ok) {
        const raw = await res.text().catch(()=>"");
        let message;
        try {
            const json = JSON.parse(raw);
            if (typeof json.detail === "string") {
                message = json.detail;
            } else if (Array.isArray(json.detail) && json.detail[0]?.msg) {
                message = json.detail.map((d)=>d.msg).join("; ");
            } else {
                message = raw || `${res.status} ${res.statusText}`;
            }
        } catch  {
            message = raw || `${res.status} ${res.statusText}`;
        }
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }
    return res.text();
}
function isoNow() {
    return new Date().toISOString();
}
function randomId() {
    return Math.random().toString(36).slice(2, 10);
}
// ---- Mock data ----
const mockEntries = [
    {
        id: "1",
        status: "succeeded",
        status_detail: null,
        source_type: "url",
        requested_url: "https://example.com/article",
        final_text_source: "example.com",
        title: "Example Article",
        created_at: "2026-01-23T10:00:00Z",
        updated_at: "2026-01-23T10:05:00Z"
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
        updated_at: "2026-01-23T10:10:00Z"
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
        updated_at: "2026-01-23T10:20:00Z"
    }
];
const mockContentById = {
    "1": {
        canonical_text: "This is the canonical text from the article.",
        extracted_text: "This is the extracted text from the article."
    },
    "2": null,
    "3": null
};
async function createItem(params) {
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
        const entry = {
            id,
            status: isPasted ? "succeeded" : "queued",
            status_detail: null,
            source_type: isPasted ? "pasted_text" : "url",
            requested_url: hasUrl ? url.trim() : null,
            final_text_source: isPasted ? "pasted_text" : null,
            title: null,
            created_at: now,
            updated_at: now
        };
        mockEntries.unshift(entry);
        if (isPasted) {
            mockContentById[id] = {
                canonical_text: pasted_text.trim(),
                user_pasted_text: pasted_text.trim()
            };
        } else {
            mockContentById[id] = null;
            setTimeout(()=>{
                const idx = mockEntries.findIndex((x)=>x.id === id);
                if (idx >= 0) mockEntries[idx] = {
                    ...mockEntries[idx],
                    status: "processing",
                    updated_at: isoNow()
                };
            }, 300);
            setTimeout(()=>{
                const ok = Math.random() < 0.75;
                const idx = mockEntries.findIndex((x)=>x.id === id);
                if (idx < 0) return;
                if (ok) {
                    mockEntries[idx] = {
                        ...mockEntries[idx],
                        status: "succeeded",
                        final_text_source: "example.com",
                        updated_at: isoNow()
                    };
                    mockContentById[id] = {
                        canonical_text: "Mock canonical text.",
                        extracted_text: "Mock extracted text."
                    };
                } else {
                    mockEntries[idx] = {
                        ...mockEntries[idx],
                        status: "needs_user_text",
                        status_detail: "Could not extract readable text; please paste it.",
                        updated_at: isoNow()
                    };
                    mockContentById[id] = null;
                }
            }, 1400);
        }
        return {
            id,
            status: entry.status
        };
    }
    const body = {
        url: hasUrl ? url.trim() : undefined,
        pasted_text: hasPasted ? pasted_text.trim() : undefined,
        prefer_pasted_text: prefer_pasted_text ?? false
    };
    return apiFetch("/items", {
        method: "POST",
        body: JSON.stringify(body)
    });
}
async function listItems(params) {
    if (USE_MOCK_API) {
        await delay(200);
        return {
            items: mockEntries,
            next_cursor: null
        };
    }
    const search = new URLSearchParams();
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.cursor != null && params.cursor !== "") search.set("cursor", params.cursor);
    const qs = search.toString() ? `?${search.toString()}` : "";
    return apiFetch(`/items${qs}`, {
        method: "GET"
    });
}
async function getItem(id, includeContent = false) {
    if (USE_MOCK_API) {
        await delay(200);
        const entry = mockEntries.find((x)=>x.id === id);
        if (!entry) {
            const err = new Error(`Item ${id} not found`);
            err.status = 404;
            throw err;
        }
        const content = includeContent ? mockContentById[id] ?? null : null;
        return {
            ...entry,
            content
        };
    }
    const qs = includeContent ? "?include_content=true" : "?include_content=false";
    return apiFetch(`/items/${id}${qs}`, {
        method: "GET"
    });
}
async function patchItemText(id, pasted_text) {
    if (USE_MOCK_API) {
        await delay(300);
        const idx = mockEntries.findIndex((x)=>x.id === id);
        if (idx < 0) {
            const err = new Error(`Item ${id} not found`);
            err.status = 404;
            throw err;
        }
        const entry = mockEntries[idx];
        if (entry.status !== "needs_user_text") {
            const e = new Error("CONFLICT");
            e.status = 409;
            throw e;
        }
        const updated = {
            ...entry,
            status: "succeeded",
            status_detail: null,
            updated_at: isoNow()
        };
        mockEntries[idx] = updated;
        mockContentById[id] = {
            canonical_text: pasted_text,
            user_pasted_text: pasted_text
        };
        return {
            ...updated,
            content: mockContentById[id]
        };
    }
    return apiFetch(`/items/${id}/text`, {
        method: "PATCH",
        body: JSON.stringify({
            pasted_text
        })
    });
}
/** GET /items/{id}/summary — fetch cached summary if it exists */ async function getCachedSummary(id) {
    try {
        const text = await apiFetchText(`/items/${id}/summary`, {
            method: "GET"
        });
        return text;
    } catch (e) {
        const err = e;
        if (err.status === 404) return null;
        throw e;
    }
}
async function generateSummary(id, modelKey) {
    if (USE_MOCK_API) {
        await delay(800);
        return {
            text: "This is a mock summary of the article. It covers the main points in a neutral, third-person tone without adding interpretation or invented context.",
            provider: "mock",
            model: "mock-model",
            latency_ms: 800
        };
    }
    // Try cache first — instant if already summarized
    const cached = await getCachedSummary(id);
    if (cached) {
        return {
            text: cached,
            provider: "cached",
            model: "cached",
            latency_ms: 0
        };
    }
    // No cache — call DeepSeek
    const qs = modelKey ? `?model_key=${modelKey}` : "";
    const text = await apiFetchText(`/items/${id}/summary${qs}`, {
        method: "POST"
    });
    return {
        text,
        provider: "deepseek",
        model: "deepseek-chat",
        latency_ms: 0
    };
}
}),
"[project]/src/app/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Page
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/itemsApi.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function getStatusCopy(item) {
    const { status, status_detail } = item;
    switch(status){
        case "queued":
            return {
                pill: "Queued",
                subtitle: "In line to read this…",
                debug: status_detail || undefined
            };
        case "processing":
            return {
                pill: "Reading…",
                subtitle: "Pulling the best text from the link…",
                debug: status_detail || undefined
            };
        case "succeeded":
            return {
                pill: "Ready",
                subtitle: "Saved for your next review.",
                debug: status_detail || undefined
            };
        case "needs_user_text":
            return {
                pill: "Needs text",
                subtitle: "Can't access this link. Paste the text and we'll save it.",
                debug: status_detail || undefined
            };
        case "failed":
            return {
                pill: "Failed",
                subtitle: "We couldn't save this. Try again or paste the text.",
                debug: status_detail || undefined
            };
        default:
            return {
                pill: status,
                subtitle: "",
                debug: status_detail || undefined
            };
    }
}
function StatusPill({ label, status }) {
    const statusStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        switch(status){
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
    }, [
        status
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles}`,
        children: label
    }, void 0, false, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
function Page() {
    const [inputType, setInputType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("url");
    const [url, setUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isManualRefresh, setIsManualRefresh] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [fallbackTextById, setFallbackTextById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [fallbackSubmittingById, setFallbackSubmittingById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [viewTab, setViewTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("digest");
    const [showSummary, setShowSummary] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showNeedsText, setShowNeedsText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasSummarized, setHasSummarized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isSummarizing, setIsSummarizing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [summaryById, setSummaryById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [summaryErrorById, setSummaryErrorById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const [includePreviousItems, setIncludePreviousItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [autosaveStatus, setAutosaveStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [lastSavedUrl, setLastSavedUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const autosaveTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const clearSavedStatusTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [textAutosaveStatus, setTextAutosaveStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [lastSavedText, setLastSavedText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const textAutosaveTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const textClearSavedStatusTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const pollingIntervalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const urlInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const refreshItems = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (isManual = false)=>{
        if (isManual) setIsManualRefresh(true);
        try {
            const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["listItems"])();
            setItems(response.items);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load items");
        } finally{
            if (isManual) setIsManualRefresh(false);
        }
    }, []);
    async function handleSubmitFallbackText(itemId) {
        const pastedText = fallbackTextById[itemId]?.trim();
        if (!pastedText) {
            setError("Please paste text before submitting.");
            return;
        }
        setFallbackSubmittingById((prev)=>({
                ...prev,
                [itemId]: true
            }));
        setError(null);
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["patchItemText"])(itemId, pastedText);
            setFallbackTextById((prev)=>{
                const next = {
                    ...prev
                };
                delete next[itemId];
                return next;
            });
            await refreshItems();
            if (hasSummarized) {
                try {
                    const summary = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["generateSummary"])(itemId);
                    setSummaryById((prev)=>({
                            ...prev,
                            [itemId]: summary
                        }));
                    setSummaryErrorById((prev)=>{
                        const next = {
                            ...prev
                        };
                        delete next[itemId];
                        return next;
                    });
                } catch (e) {
                    setSummaryErrorById((prev)=>({
                            ...prev,
                            [itemId]: e instanceof Error ? e.message : "Summary failed"
                        }));
                }
            }
        } catch (e) {
            const err = e;
            if (err.status === 409) {
                setError("This item already moved forward — refresh to see the latest status.");
            } else {
                setError(e instanceof Error ? e.message : "Failed to submit text");
            }
        } finally{
            setFallbackSubmittingById((prev)=>{
                const next = {
                    ...prev
                };
                delete next[itemId];
                return next;
            });
        }
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        refreshItems();
    }, [
        refreshItems
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const hasInProgress = items.some((item)=>item.status === "queued" || item.status === "processing");
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (hasInProgress) {
            pollingIntervalRef.current = setInterval(()=>{
                refreshItems();
            }, 1500);
        }
        return ()=>{
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [
        items,
        refreshItems
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (inputType !== "url") {
            setAutosaveStatus("idle");
            return;
        }
        const trimmed = url.trim();
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        if (clearSavedStatusTimeoutRef.current) {
            clearTimeout(clearSavedStatusTimeoutRef.current);
            clearSavedStatusTimeoutRef.current = null;
        }
        if (!trimmed) {
            setAutosaveStatus("idle");
            return;
        }
        let isValidUrl = false;
        try {
            new URL(trimmed);
            isValidUrl = true;
        } catch  {
            isValidUrl = false;
        }
        if (!isValidUrl) {
            setAutosaveStatus("invalid");
            return;
        }
        if (trimmed === lastSavedUrl) {
            setAutosaveStatus("saved");
            return;
        }
        setAutosaveStatus("typing");
        autosaveTimeoutRef.current = setTimeout(async ()=>{
            setAutosaveStatus("saving");
            try {
                const createResponse = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createItem"])({
                    url: trimmed
                });
                setLastSavedUrl(trimmed);
                setAutosaveStatus("saved");
                const fullEntry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getItem"])(createResponse.id, false);
                setItems((prev)=>[
                        fullEntry,
                        ...prev
                    ]);
                if (hasSummarized) {
                    try {
                        const summary = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["generateSummary"])(fullEntry.id);
                        setSummaryById((prev)=>({
                                ...prev,
                                [fullEntry.id]: summary
                            }));
                    } catch (e) {
                        setSummaryErrorById((prev)=>({
                                ...prev,
                                [fullEntry.id]: e instanceof Error ? e.message : "Summary failed"
                            }));
                    }
                }
                setUrl("");
                setTimeout(()=>urlInputRef.current?.focus(), 0);
                clearSavedStatusTimeoutRef.current = setTimeout(()=>{
                    setAutosaveStatus("idle");
                    clearSavedStatusTimeoutRef.current = null;
                }, 2000);
            } catch  {
                setAutosaveStatus("error");
            }
        }, 700);
        return ()=>{
            if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
            if (clearSavedStatusTimeoutRef.current) {
                clearTimeout(clearSavedStatusTimeoutRef.current);
                clearSavedStatusTimeoutRef.current = null;
            }
        };
    }, [
        url,
        inputType,
        lastSavedUrl
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (inputType !== "text") {
            setTextAutosaveStatus("idle");
            return;
        }
        const trimmed = text.trim();
        if (textAutosaveTimeoutRef.current) clearTimeout(textAutosaveTimeoutRef.current);
        if (textClearSavedStatusTimeoutRef.current) {
            clearTimeout(textClearSavedStatusTimeoutRef.current);
            textClearSavedStatusTimeoutRef.current = null;
        }
        if (!trimmed) {
            setTextAutosaveStatus("idle");
            return;
        }
        if (trimmed === lastSavedText) {
            setTextAutosaveStatus("saved");
            return;
        }
        setTextAutosaveStatus("typing");
        textAutosaveTimeoutRef.current = setTimeout(async ()=>{
            setTextAutosaveStatus("saving");
            try {
                const createResponse = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createItem"])({
                    pasted_text: trimmed
                });
                setLastSavedText(trimmed);
                setTextAutosaveStatus("saved");
                const fullEntry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getItem"])(createResponse.id, false);
                setItems((prev)=>[
                        fullEntry,
                        ...prev
                    ]);
                setText("");
                setTimeout(()=>textareaRef.current?.focus(), 0);
                textClearSavedStatusTimeoutRef.current = setTimeout(()=>{
                    setTextAutosaveStatus("idle");
                    textClearSavedStatusTimeoutRef.current = null;
                }, 2000);
            } catch  {
                setTextAutosaveStatus("error");
            }
        }, 700);
        return ()=>{
            if (textAutosaveTimeoutRef.current) clearTimeout(textAutosaveTimeoutRef.current);
            if (textClearSavedStatusTimeoutRef.current) {
                clearTimeout(textClearSavedStatusTimeoutRef.current);
                textClearSavedStatusTimeoutRef.current = null;
            }
        };
    }, [
        text,
        inputType,
        lastSavedText
    ]);
    function getStartOfWeekSunday(now) {
        const day = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        return start;
    }
    function getEndOfWeekSaturday(now) {
        const start = getStartOfWeekSunday(now);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    }
    function isWithinRange(d, start, end) {
        return d >= start && d <= end;
    }
    const now = new Date();
    const weekStart = getStartOfWeekSunday(now);
    const weekEnd = getEndOfWeekSaturday(now);
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric"
    });
    const weekLabel = `This week (Sun-Sat): ${dateFormatter.format(weekStart)} - ${dateFormatter.format(weekEnd)}`;
    async function fetchWithConcurrency(items, fetchFn, maxConcurrency) {
        const results = [];
        const executing = new Set();
        for (const item of items){
            const promise = fetchFn(item).then((result)=>{
                results.push(result);
            });
            const wrapped = promise.finally(()=>executing.delete(wrapped));
            executing.add(wrapped);
            if (executing.size >= maxConcurrency) await Promise.race(executing);
        }
        await Promise.all(executing);
        return results;
    }
    const weeklyItems = items.filter((item)=>isWithinRange(new Date(item.created_at), weekStart, weekEnd));
    const succeededItems = weeklyItems.filter((item)=>item.status === "succeeded");
    const previousItems = items.filter((item)=>item.status === "succeeded" && new Date(item.created_at) < weekStart);
    const succeededItemsForSummary = includePreviousItems ? [
        ...succeededItems,
        ...previousItems
    ] : succeededItems;
    const succeededItemIds = succeededItemsForSummary.map((item)=>item.id).join(",");
    const queuedOrProcessing = weeklyItems.filter((item)=>item.status === "queued" || item.status === "processing");
    const needsTextItems = weeklyItems.filter((item)=>item.status === "needs_user_text");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (succeededItemsForSummary.length === 0) return;
        const itemsNeedingSummary = succeededItemsForSummary.filter((item)=>!summaryById[item.id] && item.status === "succeeded");
        if (itemsNeedingSummary.length === 0) return;
        setShowSummary(true);
        setHasSummarized(true);
        const loadSummaries = async ()=>{
            await fetchWithConcurrency(itemsNeedingSummary, async (item)=>{
                try {
                    setSummaryErrorById((prev)=>{
                        const next = {
                            ...prev
                        };
                        delete next[item.id];
                        return next;
                    });
                    const summary = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["generateSummary"])(item.id);
                    setSummaryById((prev)=>({
                            ...prev,
                            [item.id]: summary
                        }));
                } catch (e) {
                    setSummaryErrorById((prev)=>({
                            ...prev,
                            [item.id]: e instanceof Error ? e.message : "Summary failed"
                        }));
                }
                return null;
            }, 3);
        };
        void loadSummaries();
    }, [
        succeededItemIds
    ]);
    function getItemDisplayTitle(item) {
        if (item.title) return item.title;
        if (item.requested_url) {
            try {
                return new URL(item.requested_url).hostname.replace(/^www\./, "");
            } catch  {
                return item.requested_url;
            }
        }
        return "Text note";
    }
    async function handleSummarize() {
        setShowSummary(true);
        setHasSummarized(true);
        setIsSummarizing(true);
        await fetchWithConcurrency(succeededItemsForSummary.filter((item)=>!summaryById[item.id]), async (item)=>{
            try {
                const summary = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["generateSummary"])(item.id);
                setSummaryById((prev)=>({
                        ...prev,
                        [item.id]: summary
                    }));
            } catch (e) {
                setSummaryErrorById((prev)=>({
                        ...prev,
                        [item.id]: e instanceof Error ? e.message : "Summary failed"
                    }));
            }
            return null;
        }, 3);
        setIsSummarizing(false);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "mx-auto max-w-3xl px-4 py-12 md:py-14",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "mb-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "font-[var(--font-script)] text-6xl md:text-7xl leading-none tracking-tight text-black",
                        children: "Nudge"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 317,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-xs uppercase tracking-[0.28em] text-[var(--nudge-accent,#b3322a)]",
                        children: "For things worth coming back to."
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 320,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "mt-2 inline-block rounded border border-black/20 bg-white/30 px-2 py-0.5 text-xs font-medium text-black/70",
                        children: process.env.NEXT_PUBLIC_USE_MOCK_API === "true" ? "Mock API" : "Backend API"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 323,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 316,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-6 flex gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setViewTab("digest"),
                        className: `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${viewTab === "digest" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                        children: "Digest"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 329,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setViewTab("saved"),
                        className: `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${viewTab === "saved" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                        children: "Saved"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 333,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 328,
                columnNumber: 7
            }, this),
            viewTab === "digest" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-2xl border border-black/15 bg-white/20 p-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-sm font-medium text-black",
                                children: "Save as:"
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 342,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setInputType("url"),
                                        className: `rounded-full border px-3 py-1 text-sm transition-colors ${inputType === "url" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                                        children: "URL"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 344,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setInputType("text"),
                                        className: `rounded-full border px-3 py-1 text-sm transition-colors ${inputType === "text" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                                        children: "Text"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 348,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 343,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 341,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4",
                        children: inputType === "url" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-sm font-medium text-black",
                                    children: "Article URL"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 357,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    ref: urlInputRef,
                                    value: url,
                                    onChange: (e)=>setUrl(e.target.value),
                                    placeholder: "Paste a link (e.g., Substack, Reddit, blog post)",
                                    className: "w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 358,
                                    columnNumber: 17
                                }, this),
                                autosaveStatus !== "idle" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-black/70",
                                    children: [
                                        autosaveStatus === "typing" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Typing..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 363,
                                            columnNumber: 53
                                        }, this),
                                        autosaveStatus === "saving" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saving..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 364,
                                            columnNumber: 53
                                        }, this),
                                        autosaveStatus === "saved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saved"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 365,
                                            columnNumber: 52
                                        }, this),
                                        autosaveStatus === "error" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#8b1a1a]",
                                            children: "Error saving"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 366,
                                            columnNumber: 52
                                        }, this),
                                        autosaveStatus === "invalid" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#8b1a1a]",
                                            children: "Invalid URL"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 367,
                                            columnNumber: 54
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 362,
                                    columnNumber: 19
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-black/60",
                                    children: 'Some sites are login or paywalled; if we cannot read the link, you will see "Needs text."'
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 370,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 356,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-sm font-medium text-black",
                                    children: "Paste text"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 374,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    ref: textareaRef,
                                    value: text,
                                    onChange: (e)=>setText(e.target.value),
                                    placeholder: "Paste the content you want to save...",
                                    rows: 6,
                                    className: "w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 375,
                                    columnNumber: 17
                                }, this),
                                textAutosaveStatus !== "idle" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-black/70",
                                    children: [
                                        textAutosaveStatus === "typing" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Typing..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 380,
                                            columnNumber: 57
                                        }, this),
                                        textAutosaveStatus === "saving" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saving..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 381,
                                            columnNumber: 57
                                        }, this),
                                        textAutosaveStatus === "saved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saved"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 382,
                                            columnNumber: 56
                                        }, this),
                                        textAutosaveStatus === "error" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#8b1a1a]",
                                            children: "Error saving"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 383,
                                            columnNumber: 56
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 379,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 373,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 354,
                        columnNumber: 11
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 rounded-lg border border-black/15 bg-white/25 px-3 py-2 text-sm text-[#8b1a1a]",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 390,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 flex items-center justify-end",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>refreshItems(true),
                            disabled: isManualRefresh,
                            className: "rounded-lg border border-black/20 bg-white/30 px-4 py-2 text-sm text-black hover:bg-white/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors",
                            children: isManualRefresh ? "Refreshing..." : "Refresh"
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 393,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 392,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 340,
                columnNumber: 9
            }, this),
            viewTab === "digest" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "mt-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-4 flex items-center justify-between border-b border-black/15 pb-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-serif font-semibold text-black",
                                        children: "Weekly summary"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 405,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-xs text-black/60",
                                        children: weekLabel
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 406,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 404,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: handleSummarize,
                                disabled: isSummarizing || succeededItemsForSummary.length === 0,
                                className: "rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors",
                                children: isSummarizing ? "Summarizing..." : "Summarize"
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 408,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 403,
                        columnNumber: 11
                    }, this),
                    showSummary && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 space-y-4",
                        children: [
                            queuedOrProcessing.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm text-black/70",
                                children: [
                                    "Still reading ",
                                    queuedOrProcessing.length,
                                    " item",
                                    queuedOrProcessing.length !== 1 ? "s" : "",
                                    "..."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 417,
                                columnNumber: 17
                            }, this),
                            needsTextItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-black/15 bg-white/20",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setShowNeedsText(!showNeedsText),
                                        className: "w-full px-4 py-3 text-left text-sm font-medium text-black flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    "Fix unreadable links (",
                                                    needsTextItems.length,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 423,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-black/60",
                                                children: showNeedsText ? "-" : "+"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 424,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 421,
                                        columnNumber: 19
                                    }, this),
                                    showNeedsText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "px-4 pb-4 space-y-3 border-t border-black/15 pt-3",
                                        children: needsTextItems.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm font-serif font-semibold text-black",
                                                        children: item.title ?? "(Untitled)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 430,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                        value: fallbackTextById[item.id] || "",
                                                        onChange: (e)=>setFallbackTextById((prev)=>({
                                                                    ...prev,
                                                                    [item.id]: e.target.value
                                                                })),
                                                        placeholder: "Paste the text content here...",
                                                        rows: 4,
                                                        className: "w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 431,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: ()=>handleSubmitFallbackText(item.id),
                                                        disabled: fallbackSubmittingById[item.id] || !fallbackTextById[item.id]?.trim(),
                                                        className: "rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                                                        children: fallbackSubmittingById[item.id] ? "Submitting..." : "Submit text"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 435,
                                                        columnNumber: 27
                                                    }, this)
                                                ]
                                            }, item.id, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 429,
                                                columnNumber: 25
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 427,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 420,
                                columnNumber: 17
                            }, this),
                            hasSummarized && succeededItemsForSummary.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4",
                                children: succeededItemsForSummary.map((item)=>{
                                    const summary = summaryById[item.id];
                                    const summaryError = summaryErrorById[item.id];
                                    const isLoading = !summary && !summaryError;
                                    const lines = summary?.text?.split("\n").map((l)=>l.trim()).filter(Boolean) ?? [];
                                    const paragraphLines = [];
                                    const listLines = [];
                                    for (const line of lines){
                                        if (line.startsWith("- ")) {
                                            listLines.push(line.slice(2).trim());
                                        } else if (listLines.length === 0) {
                                            paragraphLines.push(line);
                                        }
                                    }
                                    const paragraph = paragraphLines.join(" ");
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-black/15 bg-white/20 p-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-2 flex items-start justify-between gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-sm font-serif font-semibold text-black",
                                                        children: getItemDisplayTitle(item)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 467,
                                                        columnNumber: 27
                                                    }, this),
                                                    item.requested_url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                        href: item.requested_url,
                                                        target: "_blank",
                                                        rel: "noopener noreferrer",
                                                        className: "shrink-0 text-xs text-black/50 hover:text-black/70 underline",
                                                        children: "source"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 469,
                                                        columnNumber: 29
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 466,
                                                columnNumber: 25
                                            }, this),
                                            isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-black/50 italic",
                                                children: "Summarizing..."
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 473,
                                                columnNumber: 39
                                            }, this),
                                            summaryError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-[#8b1a1a]",
                                                children: summaryError
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 474,
                                                columnNumber: 42
                                            }, this),
                                            summary && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-sm text-black/80 leading-relaxed space-y-2",
                                                children: [
                                                    paragraph && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: paragraph
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 477,
                                                        columnNumber: 43
                                                    }, this),
                                                    listLines.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "list-none space-y-1 pl-0",
                                                        children: listLines.map((bullet, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                className: "flex gap-2",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "shrink-0 text-black/70",
                                                                        children: "—"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/page.tsx",
                                                                        lineNumber: 482,
                                                                        columnNumber: 37
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: bullet
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/page.tsx",
                                                                        lineNumber: 483,
                                                                        columnNumber: 37
                                                                    }, this)
                                                                ]
                                                            }, i, true, {
                                                                fileName: "[project]/src/app/page.tsx",
                                                                lineNumber: 481,
                                                                columnNumber: 35
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 479,
                                                        columnNumber: 31
                                                    }, this),
                                                    !paragraph && listLines.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: summary.text
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 488,
                                                        columnNumber: 70
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 476,
                                                columnNumber: 27
                                            }, this),
                                            summary && item.requested_url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 pt-2 border-t border-black/10",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                    href: item.requested_url,
                                                    target: "_blank",
                                                    rel: "noopener noreferrer",
                                                    className: "text-xs text-black/50 hover:text-black/70 underline inline-flex items-center gap-1",
                                                    children: "→ Read original"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 493,
                                                    columnNumber: 29
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 492,
                                                columnNumber: 27
                                            }, this)
                                        ]
                                    }, item.id, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 465,
                                        columnNumber: 23
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 448,
                                columnNumber: 17
                            }, this),
                            previousItems.length > 0 && !includePreviousItems && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-wrap items-center gap-2 text-sm text-black/60",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "You also have ",
                                            previousItems.length,
                                            " saved item",
                                            previousItems.length !== 1 ? "s" : "",
                                            " from previous weeks."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 507,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setIncludePreviousItems(true),
                                        className: "rounded border border-black/20 bg-white/30 px-2.5 py-1 text-xs font-medium text-black/80 hover:bg-white/40 transition-colors",
                                        children: "Include in digest"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 508,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 506,
                                columnNumber: 17
                            }, this),
                            succeededItems.length === 0 && queuedOrProcessing.length === 0 && needsTextItems.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center",
                                children: "No items this week yet."
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 519,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 415,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 402,
                columnNumber: 9
            }, this),
            viewTab === "saved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "mt-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-xl font-serif font-semibold text-black mb-4",
                        children: "Saved"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 530,
                        columnNumber: 11
                    }, this),
                    items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center",
                        children: "Nothing saved yet."
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 532,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "space-y-1 rounded-lg border border-black/15 bg-white/20 divide-y divide-black/10 overflow-hidden",
                        children: items.map((item)=>{
                            const { pill } = getStatusCopy(item);
                            const primaryLabel = item.requested_url?.trim() ? item.requested_url : "Text note";
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-medium text-black min-w-0 flex-1 break-all",
                                        children: primaryLabel
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 540,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusPill, {
                                        label: pill,
                                        status: item.status
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 541,
                                        columnNumber: 21
                                    }, this),
                                    item.status_detail && (item.status === "needs_user_text" || item.status === "failed") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "w-full text-xs text-black/50 mt-0.5",
                                        children: item.status_detail
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 543,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, item.id, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 539,
                                columnNumber: 19
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 534,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 529,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 315,
        columnNumber: 5
    }, this);
}
}),
"[project]/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    else {
        if ("TURBOPACK compile-time truthy", 1) {
            if ("TURBOPACK compile-time truthy", 1) {
                module.exports = __turbopack_context__.r("[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)");
            } else //TURBOPACK unreachable
            ;
        } else //TURBOPACK unreachable
        ;
    }
} //# sourceMappingURL=module.compiled.js.map
}),
"[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].ReactJsxDevRuntime; //# sourceMappingURL=react-jsx-dev-runtime.js.map
}),
"[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].React; //# sourceMappingURL=react.js.map
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__850e5e56._.js.map