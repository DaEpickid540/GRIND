// Internet search integration — lets AI features ground answers in live web results
// (current events, recent research, today's prices, etc). Keys live in localStorage
// only, mirroring the aiProvider.js pattern — never sent to Firestore.
//
// ContextWire is the RECOMMENDED provider: it's a multi-source research engine built
// for client apps with broad CORS support and a free tier — works directly from the
// browser with no extra infrastructure.
//
// SerpAPI and Brave Search both reject direct cross-origin browser requests (CORS).
// To use either from a hosted SPA like GRIND you'd need a small server-side proxy
// (e.g. a Firebase Cloud Function that forwards the request and attaches the key).
// We surface that clearly in Settings so it's never a silent failure.

export const SEARCH_PROVIDERS = {
  contextwire: {
    id: "contextwire",
    label: "ContextWire",
    recommended: true,
    site: "contextwire.dev",
    keyHelp: "Grab a free API key at contextwire.dev — no card required.",
    desc: "Multi-source research engine with no LLM lock-in. Built for client apps — works directly from the browser.",
    needsProxy: false,
  },
  serpapi: {
    id: "serpapi",
    label: "SerpAPI",
    recommended: false,
    site: "serpapi.com",
    keyHelp: "Get a key at serpapi.com/manage-api-key.",
    desc: "Structured Google/Bing/DuckDuckGo search results as JSON.",
    needsProxy: true,
  },
  brave: {
    id: "brave",
    label: "Brave Search",
    recommended: false,
    site: "brave.com/search/api",
    keyHelp: "Get a key from the Brave Search API dashboard.",
    desc: "Independent search index, generous free tier, privacy-first.",
    needsProxy: true,
  },
};

const LS_KEY = "grind_search_config";

export const DEFAULT_SEARCH_CONFIG = { provider: "contextwire", key: "", enabled: false };

export function getSearchConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_SEARCH_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_SEARCH_CONFIG };
  } catch { return { ...DEFAULT_SEARCH_CONFIG }; }
}

export function saveSearchConfig(config) {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export function clearSearchConfig() {
  localStorage.removeItem(LS_KEY);
}

// "Usable" = enabled, has a provider + key, AND that provider supports direct
// client-side calls (i.e. doesn't need a proxy we haven't built).
export function isSearchUsable() {
  const cfg = getSearchConfig();
  if (!cfg?.enabled || !cfg?.provider || !cfg?.key?.trim()) return false;
  const prov = SEARCH_PROVIDERS[cfg.provider];
  return !!prov && !prov.needsProxy;
}

// Run a live web search. Returns [{ title, snippet, url }]. Throws:
//   NO_SEARCH_CONFIG — not set up / disabled / missing key
//   NEEDS_PROXY      — provider chosen requires a server-side proxy we don't have yet
export async function webSearch(queryStr, { maxResults = 5 } = {}) {
  const cfg = getSearchConfig();
  if (!cfg?.enabled || !cfg?.provider || !cfg?.key?.trim()) throw new Error("NO_SEARCH_CONFIG");
  const prov = SEARCH_PROVIDERS[cfg.provider];
  if (!prov) throw new Error("Unknown search provider");
  if (prov.needsProxy) throw new Error("NEEDS_PROXY");

  // ContextWire — direct client-side call
  const res = await fetch("https://api.contextwire.dev/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.key.trim()}` },
    body: JSON.stringify({ query: queryStr, max_results: maxResults }),
  });
  if (!res.ok) throw new Error(`ContextWire search failed (${res.status})`);
  const data = await res.json();
  const items = data.results || data.sources || data.data || [];
  return items.slice(0, maxResults).map(r => ({
    title:   r.title   || r.name    || "Untitled",
    snippet: r.snippet || r.summary || r.content || "",
    url:     r.url     || r.link    || "",
  }));
}

// Build a grounding block to splice into an AI system/user prompt — keeps the
// "search → inject as context" wiring in one place for any feature that wants it.
export async function buildSearchContext(queryStr) {
  try {
    const results = await webSearch(queryStr);
    if (!results.length) return "";
    return "Live web search results (use these to ground your answer in current info — cite sources naturally):\n" +
      results.map((r, i) => `${i+1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`).join("\n");
  } catch {
    return ""; // search is best-effort grounding — never block the AI call on it
  }
}
