(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/itemsApi.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
const USE_MOCK_API = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_USE_MOCK_API === "true";
const API_BASE_URL = (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Page
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/itemsApi.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
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
    _s();
    const statusStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "StatusPill.useMemo[statusStyles]": ()=>{
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
        }
    }["StatusPill.useMemo[statusStyles]"], [
        status
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles}`,
        children: label
    }, void 0, false, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_s(StatusPill, "DsEeVNcN3aMrOxBEvScVprDdJLI=");
_c = StatusPill;
function Page() {
    _s1();
    const [inputType, setInputType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("url");
    const [url, setUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isManualRefresh, setIsManualRefresh] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [fallbackTextById, setFallbackTextById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [fallbackSubmittingById, setFallbackSubmittingById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [viewTab, setViewTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("digest");
    const [showSummary, setShowSummary] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showNeedsText, setShowNeedsText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasSummarized, setHasSummarized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isSummarizing, setIsSummarizing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [summaryById, setSummaryById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [summaryErrorById, setSummaryErrorById] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [autosaveStatus, setAutosaveStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [lastSavedUrl, setLastSavedUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const autosaveTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const clearSavedStatusTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [textAutosaveStatus, setTextAutosaveStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [lastSavedText, setLastSavedText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const textAutosaveTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const textClearSavedStatusTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const pollingIntervalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const urlInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const textareaRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const refreshItems = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Page.useCallback[refreshItems]": async (isManual = false)=>{
            if (isManual) setIsManualRefresh(true);
            try {
                const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listItems"])();
                setItems(response.items);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to load items");
            } finally{
                if (isManual) setIsManualRefresh(false);
            }
        }
    }["Page.useCallback[refreshItems]"], []);
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
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["patchItemText"])(itemId, pastedText);
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
                    const summary = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateSummary"])(itemId);
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
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
            refreshItems();
        }
    }["Page.useEffect"], [
        refreshItems
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
            const hasInProgress = items.some({
                "Page.useEffect.hasInProgress": (item)=>item.status === "queued" || item.status === "processing"
            }["Page.useEffect.hasInProgress"]);
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            if (hasInProgress) {
                pollingIntervalRef.current = setInterval({
                    "Page.useEffect": ()=>{
                        refreshItems();
                    }
                }["Page.useEffect"], 1500);
            }
            return ({
                "Page.useEffect": ()=>{
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                }
            })["Page.useEffect"];
        }
    }["Page.useEffect"], [
        items,
        refreshItems
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
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
            autosaveTimeoutRef.current = setTimeout({
                "Page.useEffect": async ()=>{
                    setAutosaveStatus("saving");
                    try {
                        const createResponse = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createItem"])({
                            url: trimmed
                        });
                        setLastSavedUrl(trimmed);
                        setAutosaveStatus("saved");
                        const fullEntry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getItem"])(createResponse.id, false);
                        setItems({
                            "Page.useEffect": (prev)=>[
                                    fullEntry,
                                    ...prev
                                ]
                        }["Page.useEffect"]);
                        setUrl("");
                        setTimeout({
                            "Page.useEffect": ()=>urlInputRef.current?.focus()
                        }["Page.useEffect"], 0);
                        clearSavedStatusTimeoutRef.current = setTimeout({
                            "Page.useEffect": ()=>{
                                setAutosaveStatus("idle");
                                clearSavedStatusTimeoutRef.current = null;
                            }
                        }["Page.useEffect"], 2000);
                    } catch  {
                        setAutosaveStatus("error");
                    }
                }
            }["Page.useEffect"], 700);
            return ({
                "Page.useEffect": ()=>{
                    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
                    if (clearSavedStatusTimeoutRef.current) {
                        clearTimeout(clearSavedStatusTimeoutRef.current);
                        clearSavedStatusTimeoutRef.current = null;
                    }
                }
            })["Page.useEffect"];
        }
    }["Page.useEffect"], [
        url,
        inputType,
        lastSavedUrl
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Page.useEffect": ()=>{
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
            textAutosaveTimeoutRef.current = setTimeout({
                "Page.useEffect": async ()=>{
                    setTextAutosaveStatus("saving");
                    try {
                        const createResponse = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createItem"])({
                            pasted_text: trimmed
                        });
                        setLastSavedText(trimmed);
                        setTextAutosaveStatus("saved");
                        const fullEntry = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getItem"])(createResponse.id, false);
                        setItems({
                            "Page.useEffect": (prev)=>[
                                    fullEntry,
                                    ...prev
                                ]
                        }["Page.useEffect"]);
                        setText("");
                        setTimeout({
                            "Page.useEffect": ()=>textareaRef.current?.focus()
                        }["Page.useEffect"], 0);
                        textClearSavedStatusTimeoutRef.current = setTimeout({
                            "Page.useEffect": ()=>{
                                setTextAutosaveStatus("idle");
                                textClearSavedStatusTimeoutRef.current = null;
                            }
                        }["Page.useEffect"], 2000);
                    } catch  {
                        setTextAutosaveStatus("error");
                    }
                }
            }["Page.useEffect"], 700);
            return ({
                "Page.useEffect": ()=>{
                    if (textAutosaveTimeoutRef.current) clearTimeout(textAutosaveTimeoutRef.current);
                    if (textClearSavedStatusTimeoutRef.current) {
                        clearTimeout(textClearSavedStatusTimeoutRef.current);
                        textClearSavedStatusTimeoutRef.current = null;
                    }
                }
            })["Page.useEffect"];
        }
    }["Page.useEffect"], [
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
    const weeklyItems = items.filter((item)=>isWithinRange(new Date(item.created_at), weekStart, weekEnd));
    const succeededItems = weeklyItems.filter((item)=>item.status === "succeeded");
    const queuedOrProcessing = weeklyItems.filter((item)=>item.status === "queued" || item.status === "processing");
    const needsTextItems = weeklyItems.filter((item)=>item.status === "needs_user_text");
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
        setSummaryById({});
        setSummaryErrorById({});
        await fetchWithConcurrency(succeededItems, async (item)=>{
            try {
                const summary = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$itemsApi$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateSummary"])(item.id);
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "mx-auto max-w-3xl px-4 py-12 md:py-14",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "mb-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "font-[var(--font-script)] text-6xl md:text-7xl leading-none tracking-tight text-black",
                        children: "Nudge"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 264,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-xs uppercase tracking-[0.28em] text-[var(--nudge-accent,#b3322a)]",
                        children: "For things worth coming back to."
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 267,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "mt-2 inline-block rounded border border-black/20 bg-white/30 px-2 py-0.5 text-xs font-medium text-black/70",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_USE_MOCK_API === "true" ? "Mock API" : "Backend API"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 270,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 263,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-6 flex gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setViewTab("digest"),
                        className: `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${viewTab === "digest" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                        children: "Digest"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 276,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>setViewTab("saved"),
                        className: `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${viewTab === "saved" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                        children: "Saved"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 280,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 275,
                columnNumber: 7
            }, this),
            viewTab === "digest" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "rounded-2xl border border-black/15 bg-white/20 p-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "text-sm font-medium text-black",
                                children: "Save as:"
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 289,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setInputType("url"),
                                        className: `rounded-full border px-3 py-1 text-sm transition-colors ${inputType === "url" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                                        children: "URL"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 291,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setInputType("text"),
                                        className: `rounded-full border px-3 py-1 text-sm transition-colors ${inputType === "text" ? "bg-black text-[var(--nudge-bg)] border-black" : "bg-white/30 text-black border-black/20 hover:bg-white/40"}`,
                                        children: "Text"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 295,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 290,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 288,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4",
                        children: inputType === "url" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-sm font-medium text-black",
                                    children: "Article URL"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 304,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    ref: urlInputRef,
                                    value: url,
                                    onChange: (e)=>setUrl(e.target.value),
                                    placeholder: "Paste a link (e.g., Substack, Reddit, blog post)",
                                    className: "w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 305,
                                    columnNumber: 17
                                }, this),
                                autosaveStatus !== "idle" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-black/70",
                                    children: [
                                        autosaveStatus === "typing" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Typing..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 310,
                                            columnNumber: 53
                                        }, this),
                                        autosaveStatus === "saving" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saving..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 311,
                                            columnNumber: 53
                                        }, this),
                                        autosaveStatus === "saved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saved"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 312,
                                            columnNumber: 52
                                        }, this),
                                        autosaveStatus === "error" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#8b1a1a]",
                                            children: "Error saving"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 313,
                                            columnNumber: 52
                                        }, this),
                                        autosaveStatus === "invalid" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#8b1a1a]",
                                            children: "Invalid URL"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 314,
                                            columnNumber: 54
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 309,
                                    columnNumber: 19
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-black/60",
                                    children: 'Some sites are login or paywalled; if we cannot read the link, you will see "Needs text."'
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 317,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 303,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "text-sm font-medium text-black",
                                    children: "Paste text"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 321,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    ref: textareaRef,
                                    value: text,
                                    onChange: (e)=>setText(e.target.value),
                                    placeholder: "Paste the content you want to save...",
                                    rows: 6,
                                    className: "w-full rounded-lg border border-black/20 bg-white/50 px-3 py-2 text-sm text-black placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 322,
                                    columnNumber: 17
                                }, this),
                                textAutosaveStatus !== "idle" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-black/70",
                                    children: [
                                        textAutosaveStatus === "typing" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Typing..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 327,
                                            columnNumber: 57
                                        }, this),
                                        textAutosaveStatus === "saving" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saving..."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 328,
                                            columnNumber: 57
                                        }, this),
                                        textAutosaveStatus === "saved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Saved"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 329,
                                            columnNumber: 56
                                        }, this),
                                        textAutosaveStatus === "error" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#8b1a1a]",
                                            children: "Error saving"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 330,
                                            columnNumber: 56
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 326,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 320,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 301,
                        columnNumber: 11
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 rounded-lg border border-black/15 bg-white/25 px-3 py-2 text-sm text-[#8b1a1a]",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 337,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 flex items-center justify-end",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>refreshItems(true),
                            disabled: isManualRefresh,
                            className: "rounded-lg border border-black/20 bg-white/30 px-4 py-2 text-sm text-black hover:bg-white/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors",
                            children: isManualRefresh ? "Refreshing..." : "Refresh"
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 340,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 339,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 287,
                columnNumber: 9
            }, this),
            viewTab === "digest" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "mt-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-4 flex items-center justify-between border-b border-black/15 pb-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-xl font-serif font-semibold text-black",
                                        children: "Weekly summary"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 352,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-xs text-black/60",
                                        children: weekLabel
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 353,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 351,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                onClick: handleSummarize,
                                disabled: isSummarizing || succeededItems.length === 0,
                                className: "rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors",
                                children: isSummarizing ? "Summarizing..." : "Summarize"
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 355,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 350,
                        columnNumber: 11
                    }, this),
                    showSummary && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-4 space-y-4",
                        children: [
                            queuedOrProcessing.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                lineNumber: 364,
                                columnNumber: 17
                            }, this),
                            needsTextItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-black/15 bg-white/20",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setShowNeedsText(!showNeedsText),
                                        className: "w-full px-4 py-3 text-left text-sm font-medium text-black flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    "Fix unreadable links (",
                                                    needsTextItems.length,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 370,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-black/60",
                                                children: showNeedsText ? "-" : "+"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 371,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 368,
                                        columnNumber: 19
                                    }, this),
                                    showNeedsText && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "px-4 pb-4 space-y-3 border-t border-black/15 pt-3",
                                        children: needsTextItems.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm font-serif font-semibold text-black",
                                                        children: item.title ?? "(Untitled)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 377,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
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
                                                        lineNumber: 378,
                                                        columnNumber: 27
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        onClick: ()=>handleSubmitFallbackText(item.id),
                                                        disabled: fallbackSubmittingById[item.id] || !fallbackTextById[item.id]?.trim(),
                                                        className: "rounded-lg bg-black text-[var(--nudge-bg)] px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                                                        children: fallbackSubmittingById[item.id] ? "Submitting..." : "Submit text"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 382,
                                                        columnNumber: 27
                                                    }, this)
                                                ]
                                            }, item.id, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 376,
                                                columnNumber: 25
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 374,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 367,
                                columnNumber: 17
                            }, this),
                            hasSummarized && succeededItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4",
                                children: succeededItems.map((item)=>{
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
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-black/15 bg-white/20 p-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-2 flex items-start justify-between gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "text-sm font-serif font-semibold text-black",
                                                        children: getItemDisplayTitle(item)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 414,
                                                        columnNumber: 27
                                                    }, this),
                                                    item.requested_url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                        href: item.requested_url,
                                                        target: "_blank",
                                                        rel: "noopener noreferrer",
                                                        className: "shrink-0 text-xs text-black/50 hover:text-black/70 underline",
                                                        children: "source"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 416,
                                                        columnNumber: 29
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 413,
                                                columnNumber: 25
                                            }, this),
                                            isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-black/50 italic",
                                                children: "Summarizing..."
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 420,
                                                columnNumber: 39
                                            }, this),
                                            summaryError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-[#8b1a1a]",
                                                children: summaryError
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 421,
                                                columnNumber: 42
                                            }, this),
                                            summary && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-sm text-black/80 leading-relaxed space-y-2",
                                                children: [
                                                    paragraph && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: paragraph
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 424,
                                                        columnNumber: 43
                                                    }, this),
                                                    listLines.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "list-none space-y-1 pl-0",
                                                        children: listLines.map((bullet, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                                className: "flex gap-2",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "shrink-0 text-black/70",
                                                                        children: "—"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/page.tsx",
                                                                        lineNumber: 429,
                                                                        columnNumber: 37
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: bullet
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/page.tsx",
                                                                        lineNumber: 430,
                                                                        columnNumber: 37
                                                                    }, this)
                                                                ]
                                                            }, i, true, {
                                                                fileName: "[project]/src/app/page.tsx",
                                                                lineNumber: 428,
                                                                columnNumber: 35
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 426,
                                                        columnNumber: 31
                                                    }, this),
                                                    !paragraph && listLines.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        children: summary.text
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 435,
                                                        columnNumber: 70
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 423,
                                                columnNumber: 27
                                            }, this),
                                            summary && item.requested_url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mt-3 pt-2 border-t border-black/10",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                    href: item.requested_url,
                                                    target: "_blank",
                                                    rel: "noopener noreferrer",
                                                    className: "text-xs text-black/50 hover:text-black/70 underline inline-flex items-center gap-1",
                                                    children: "→ Read original"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 440,
                                                    columnNumber: 29
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 439,
                                                columnNumber: 27
                                            }, this)
                                        ]
                                    }, item.id, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 412,
                                        columnNumber: 23
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 395,
                                columnNumber: 17
                            }, this),
                            succeededItems.length === 0 && queuedOrProcessing.length === 0 && needsTextItems.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center",
                                children: "No items this week yet."
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 453,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 362,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 349,
                columnNumber: 9
            }, this),
            viewTab === "saved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "mt-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-xl font-serif font-semibold text-black mb-4",
                        children: "Saved"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 464,
                        columnNumber: 11
                    }, this),
                    items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded-lg border border-black/15 bg-white/20 p-6 text-sm text-black/70 text-center",
                        children: "Nothing saved yet."
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 466,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "space-y-1 rounded-lg border border-black/15 bg-white/20 divide-y divide-black/10 overflow-hidden",
                        children: items.map((item)=>{
                            const { pill } = getStatusCopy(item);
                            const primaryLabel = item.requested_url?.trim() ? item.requested_url : "Text note";
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-medium text-black min-w-0 flex-1 break-all",
                                        children: primaryLabel
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 474,
                                        columnNumber: 21
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusPill, {
                                        label: pill,
                                        status: item.status
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 475,
                                        columnNumber: 21
                                    }, this),
                                    item.status_detail && (item.status === "needs_user_text" || item.status === "failed") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "w-full text-xs text-black/50 mt-0.5",
                                        children: item.status_detail
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 477,
                                        columnNumber: 23
                                    }, this)
                                ]
                            }, item.id, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 473,
                                columnNumber: 19
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 468,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 463,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 262,
        columnNumber: 5
    }, this);
}
_s1(Page, "1UMcQ0Qb2GUM2Adl9Md/RsR0h7k=");
_c1 = Page;
var _c, _c1;
__turbopack_context__.k.register(_c, "StatusPill");
__turbopack_context__.k.register(_c1, "Page");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
/**
 * @license React
 * react-jsx-dev-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
                return "Activity";
            case REACT_VIEW_TRANSITION_TYPE:
                return "ViewTransition";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
        try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
        } catch (x) {
            return "<...>";
        }
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
        return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.defineProperty(type, "_debugStack", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
            for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
        } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
    };
    React = {
        react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
        }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
            var previousStackTraceLimit = Error.stackTraceLimit;
            Error.stackTraceLimit = 10;
            var debugStackDEV = Error("react-stack-top-frame");
            Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
}();
}),
"[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)");
}
}),
]);

//# sourceMappingURL=_7492b891._.js.map