// ── AI Provider abstraction ────────────────────────────────────────────────
// All AI features route through callAI(). Keys live in localStorage only.

export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    icon: "🟠",
    url: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-api03-...",
    models: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-20250514",
    color: "#FF6B35",
  },
  gemini: {
    name: "Google Gemini",
    icon: "🔵",
    url: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash",
    color: "#4285F4",
  },
  groq: {
    name: "Groq",
    icon: "⚡",
    url: "https://console.groq.com/keys",
    placeholder: "gsk_...",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    defaultModel: "llama-3.3-70b-versatile",
    color: "#F55036",
  },
  openrouter: {
    name: "OpenRouter",
    icon: "🔀",
    url: "https://openrouter.ai/keys",
    placeholder: "sk-or-v1-...",
    models: ["meta-llama/llama-3.3-70b-instruct", "google/gemini-flash-1.5", "deepseek/deepseek-r1"],
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    color: "#7C3AED",
  },
};

const LS_KEY = "grind_ai_config";

export function getAIConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveAIConfig(config) {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export function clearAIConfig() {
  localStorage.removeItem(LS_KEY);
}

export function hasValidKey() {
  const cfg = getAIConfig();
  return !!(cfg?.provider && cfg?.key?.trim());
}

// ── Unified AI call ────────────────────────────────────────────────────────
export async function callAI({ system, userMessage, imageBase64, imageMime, maxTokens = 1000 }) {
  const cfg = getAIConfig();
  if (!cfg?.provider || !cfg?.key) throw new Error("NO_KEY");

  const { provider, key, model } = cfg;
  const prov = PROVIDERS[provider];
  if (!prov) throw new Error("Unknown provider");

  const actualModel = model || prov.defaultModel;

  // ── Anthropic ──
  if (provider === "anthropic") {
    const content = [];
    if (imageBase64) content.push({ type:"image", source:{ type:"base64", media_type:imageMime||"image/jpeg", data:imageBase64 } });
    content.push({ type:"text", text:userMessage });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:actualModel, max_tokens:maxTokens, system, messages:[{ role:"user", content }] }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic ${res.status}`);
    }
    const data = await res.json();
    return data.content.find(b => b.type==="text")?.text || "";
  }

  // ── Gemini ──
  if (provider === "gemini") {
    const parts = [];
    if (imageBase64) parts.push({ inlineData:{ mimeType:imageMime||"image/jpeg", data:imageBase64 } });
    parts.push({ text: userMessage });

    const fullPrompt = system ? `${system}\n\n${userMessage}` : userMessage;
    const bodyParts = [];
    if (imageBase64) bodyParts.push({ inlineData:{ mimeType:imageMime||"image/jpeg", data:imageBase64 } });
    bodyParts.push({ text: fullPrompt });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ contents:[{ parts:bodyParts }], generationConfig:{ maxOutputTokens:maxTokens } }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  // ── Groq ──
  if (provider === "groq") {
    const messages = [];
    if (system) messages.push({ role:"system", content:system });
    // Groq doesn't support vision on most models — attach image as text note
    const userContent = imageBase64
      ? `${userMessage}\n[Note: An image was provided but vision is model-dependent on Groq]`
      : userMessage;
    messages.push({ role:"user", content:userContent });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
      body: JSON.stringify({ model:actualModel, max_tokens:maxTokens, messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // ── OpenRouter ──
  if (provider === "openrouter") {
    const messages = [];
    if (system) messages.push({ role:"system", content:system });
    const userContent = imageBase64
      ? [{ type:"image_url", image_url:{ url:`data:${imageMime||"image/jpeg"};base64,${imageBase64}` } }, { type:"text", text:userMessage }]
      : userMessage;
    messages.push({ role:"user", content:userContent });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${key}`, "HTTP-Referer":"https://grind.app", "X-Title":"GRIND" },
      body: JSON.stringify({ model:actualModel, max_tokens:maxTokens, messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenRouter ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(`Provider ${provider} not implemented`);
}

// ── Test key ───────────────────────────────────────────────────────────────
export async function testKey(provider, key, model) {
  const tmpCfg = { provider, key, model };
  saveAIConfig(tmpCfg); // temporarily set so callAI picks it up
  try {
    const result = await callAI({ system:"You are a test.", userMessage:"Reply with exactly: OK", maxTokens:10 });
    return result.trim().includes("OK") || result.trim().length > 0;
  } catch(e) {
    throw e;
  }
}
