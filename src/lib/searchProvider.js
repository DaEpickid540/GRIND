// Internet search integration — lets AI features ground answers in live web results
// (current events, recent research, today's prices, etc). Keys live in localStorage
// only, mirroring the aiProvider.js pattern — never sent to Firestore.
//
// Tavily is the RECOMMENDED provider: it's a real general web search API that answers
// direct cross-origin browser requests, so it works from a hosted SPA with just a key.
//
// DuckDuckGo needs no key at all, but its public Instant Answer API is NOT a general
// web search — it only returns encyclopedia-style entity answers ("creatine", "BMI").
// Open-ended queries come back completely empty. Useful for grounding terminology,
// useless for "what's new in X" — we say so plainly rather than let it silently no-op.
//
// SerpAPI and Brave Search both reject direct cross-origin browser requests (CORS).
// To use either from a hosted SPA like GRIND you'd need a small server-side proxy
// (e.g. a Firebase Cloud Function that forwards the request and attaches the key).
// We surface that clearly in Settings so it's never a silent failure.

export const SEARCH_PROVIDERS = {
  tavily: {
    id: "tavily",
    label: "Tavily",
    recommended: true,
    site: "tavily.com",
    keyHelp: "Get a free key at tavily.com — keys start with tvly-.",
    desc: "Search API built for AI apps — real general web results, works directly from the browser.",
    needsKey: true,
    needsProxy: false,
  },
  contextwire: {
    id: "contextwire",
    label: "ContextWire",
    recommended: false,
    site: "contextwire.dev",
    keyHelp: "Grab a free API key at contextwire.dev — no card required.",
    desc: "Multi-source research engine with no LLM lock-in. Built for client apps — works directly from the browser.",
    needsKey: true,
    needsProxy: false,
  },
  duckduckgo: {
    id: "duckduckgo",
    label: "DuckDuckGo",
    recommended: false,
    site: "duckduckgo.com",
    keyHelp: "No API key needed — nothing to set up.",
    desc: "Free, no key, no signup — but it only does encyclopedia-style definition lookups (\"creatine\", \"BMI\"), not live web results. Open-ended questions come back empty.",
    needsKey: false,
    needsProxy: false,
  },
  serpapi: {
    id: "serpapi",
    label: "SerpAPI",
    recommended: false,
    site: "serpapi.com",
    keyHelp: "Get a key at serpapi.com/manage-api-key.",
    desc: "Structured Google/Bing/DuckDuckGo search results as JSON.",
    needsKey: true,
    needsProxy: true,
  },
  brave: {
    id: "brave",
    label: "Brave Search",
    recommended: false,
    site: "brave.com/search/api",
    keyHelp: "Get a key from the Brave Search API dashboard.",
    desc: "Independent search index, generous free tier, privacy-first.",
    needsKey: true,
    needsProxy: true,
  },
};

// Providers are key-requiring unless they explicitly opt out, so a provider added
// without thinking about it fails closed rather than silently calling with no auth.
export function providerNeedsKey(prov) {
  return prov?.needsKey !== false;
}

const LS_KEY = "grind_search_config";

export const DEFAULT_SEARCH_CONFIG = { provider: "tavily", key: "", enabled: false };

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

// "Usable" = enabled, has a provider (+ a key if that provider needs one), AND that
// provider supports direct client-side calls (i.e. doesn't need a proxy we haven't built).
export function isSearchUsable() {
  const cfg = getSearchConfig();
  if (!cfg?.enabled || !cfg?.provider) return false;
  const prov = SEARCH_PROVIDERS[cfg.provider];
  if (!prov || prov.needsProxy) return false;
  return !providerNeedsKey(prov) || !!cfg.key?.trim();
}

// Run a live web search. Returns [{ title, snippet, url }]. Throws:
//   NO_SEARCH_CONFIG — not set up / disabled / missing a key the provider requires
//   NEEDS_PROXY      — provider chosen requires a server-side proxy we don't have yet
export async function webSearch(queryStr, { maxResults = 5 } = {}) {
  const cfg = getSearchConfig();
  if (!cfg?.enabled || !cfg?.provider) throw new Error("NO_SEARCH_CONFIG");
  const prov = SEARCH_PROVIDERS[cfg.provider];
  if (!prov) throw new Error("Unknown search provider");
  if (prov.needsProxy) throw new Error("NEEDS_PROXY");
  const key = cfg.key?.trim() || "";
  if (providerNeedsKey(prov) && !key) throw new Error("NO_SEARCH_CONFIG");

  if (prov.id === "duckduckgo") return ddgSearch(queryStr, maxResults);
  if (prov.id === "tavily")     return tavilySearch(queryStr, maxResults, key);
  return contextwireSearch(queryStr, maxResults, key);
}

async function contextwireSearch(queryStr, maxResults, key) {
  const res = await fetch("https://api.contextwire.dev/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
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

async function tavilySearch(queryStr, maxResults, key) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: queryStr, max_results: maxResults }),
  });
  if (!res.ok) throw new Error(`Tavily search failed (${res.status})`);
  const data = await res.json();
  return (data.results || []).slice(0, maxResults).map(r => ({
    title:   r.title || "Untitled",
    snippet: r.content || "",
    url:     r.url || "",
  }));
}

// DuckDuckGo Instant Answer — entity/definition lookups only. Empty is the NORMAL
// outcome for anything open-ended, so we return [] instead of treating it as failure.
async function ddgSearch(queryStr, maxResults) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(queryStr)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DuckDuckGo search failed (${res.status})`);
  const data = await res.json();

  const out = [];
  if (data.AbstractText) {
    out.push({
      title:   data.Heading || data.AbstractSource || queryStr,
      snippet: data.AbstractText,
      url:     data.AbstractURL || "",
    });
  }
  // RelatedTopics is heterogeneous: leaf entries have Text/FirstURL, but disambiguation
  // groups instead carry a nested Topics[] — skip those rather than emitting blanks.
  for (const t of data.RelatedTopics || []) {
    if (out.length >= maxResults) break;
    if (!t?.Text) continue;
    out.push({
      title:   t.Text.split(" - ")[0].slice(0, 80),
      snippet: t.Text,
      url:     t.FirstURL || "",
    });
  }
  return out.slice(0, maxResults);
}

// Build a grounding block to splice into an AI system/user prompt — keeps the
// "search → inject as context" wiring in one place for any feature that wants it.
export async function buildSearchContext(queryStr) {
  try {
    const results = await webSearch(queryStr);
    if (!results.length) return ""; // e.g. DDG with no instant answer — no header, no noise
    return "Live web search results (use these to ground your answer in current info — cite sources naturally):\n" +
      results.map((r, i) => `${i+1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`).join("\n");
  } catch {
    return ""; // search is best-effort grounding — never block the AI call on it
  }
}
