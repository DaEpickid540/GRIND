// ── AI Provider abstraction ────────────────────────────────────────────────
// All AI features route through callAI(). Keys live in localStorage only.

export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    icon: "🟠",
    url: "https://console.anthropic.com/settings/keys",
    freeKey: false,                              // paid only
    placeholder: "sk-ant-api03-...",
    models: [
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001",
    ],
    defaultModel: "claude-sonnet-4-20250514",
    color: "#FF6B35",
  },
  gemini: {
    name: "Google Gemini",
    icon: "🔵",
    url: "https://aistudio.google.com/app/apikey",
    freeKey: true,                               // free tier available
    placeholder: "AIza...",
    models: [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ],
    defaultModel: "gemini-2.0-flash",
    color: "#4285F4",
  },
  openai: {
    name: "OpenAI",
    icon: "🟢",
    url: "https://platform.openai.com/api-keys",
    freeKey: false,                              // pay-per-use
    placeholder: "sk-...",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-3.5-turbo",
    ],
    defaultModel: "gpt-4o",
    color: "#10A37F",
  },
  groq: {
    name: "Groq",
    icon: "⚡",
    url: "https://console.groq.com/keys",
    freeKey: true,
    placeholder: "gsk_...",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.2-11b-vision-preview",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
    defaultModel: "llama-3.3-70b-versatile",
    color: "#F55036",
  },
  openrouter: {
    name: "OpenRouter",
    icon: "🔀",
    url: "https://openrouter.ai/keys",
    freeKey: true,                               // many free models
    placeholder: "sk-or-v1-...",
    models: [
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-flash-1.5",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
      "deepseek/deepseek-r1",
    ],
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    color: "#7C3AED",
  },
  cloudflare: {
    name: "Cloudflare AI",
    icon: "🌤️",
    url: "https://dash.cloudflare.com/profile/api-tokens",
    freeKey: true,
    placeholder: "ACCOUNT_ID|API_TOKEN",
    keyHint: "Paste as: your-account-id|your-api-token  (find both in Cloudflare dashboard)",
    models: [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3.2-11b-vision-instruct",
      "@cf/mistral/mistral-7b-instruct-v0.1",
    ],
    defaultModel: "@cf/meta/llama-3.1-8b-instruct",
    color: "#F6821F",
  },
};

// ── Per-model metadata (vision support, speed tier, display label) ─────────
// Used by SettingsModal to show vision warnings and tier badges.
export const MODEL_INFO = {
  // Anthropic
  "claude-sonnet-4-20250514":              { vision: true,  tier: "best",    label: "Claude Sonnet 4"        },
  "claude-haiku-4-5-20251001":             { vision: true,  tier: "fast",    label: "Claude Haiku 4.5"       },
  // Gemini
  "gemini-2.0-flash":                      { vision: true,  tier: "fast",    label: "Gemini 2.0 Flash"       },
  "gemini-1.5-flash":                      { vision: true,  tier: "fast",    label: "Gemini 1.5 Flash"       },
  "gemini-1.5-pro":                        { vision: true,  tier: "best",    label: "Gemini 1.5 Pro"         },
  // OpenAI
  "gpt-4o":                                { vision: true,  tier: "best",    label: "GPT-4o"                 },
  "gpt-4o-mini":                           { vision: true,  tier: "fast",    label: "GPT-4o Mini"            },
  "gpt-3.5-turbo":                         { vision: false, tier: "fast",    label: "GPT-3.5 Turbo"          },
  // Groq
  "llama-3.3-70b-versatile":               { vision: false, tier: "fast",    label: "Llama 3.3 70B"          },
  "llama-3.2-11b-vision-preview":          { vision: true,  tier: "fast",    label: "Llama 3.2 11B Vision"   },
  "llama-3.1-8b-instant":                  { vision: false, tier: "fastest", label: "Llama 3.1 8B Instant"   },
  "mixtral-8x7b-32768":                    { vision: false, tier: "fast",    label: "Mixtral 8x7B"           },
  // OpenRouter
  "meta-llama/llama-3.3-70b-instruct":     { vision: false, tier: "fast",    label: "Llama 3.3 70B"          },
  "google/gemini-flash-1.5":               { vision: true,  tier: "fast",    label: "Gemini Flash 1.5"       },
  "anthropic/claude-3.5-sonnet":           { vision: true,  tier: "best",    label: "Claude 3.5 Sonnet"      },
  "openai/gpt-4o-mini":                    { vision: true,  tier: "fast",    label: "GPT-4o Mini"            },
  "deepseek/deepseek-r1":                  { vision: false, tier: "best",    label: "DeepSeek R1"            },
  // Cloudflare
  "@cf/meta/llama-3.1-8b-instruct":        { vision: false, tier: "fast",    label: "Llama 3.1 8B"           },
  "@cf/meta/llama-3.2-11b-vision-instruct":{ vision: true,  tier: "fast",    label: "Llama 3.2 11B Vision"   },
  "@cf/mistral/mistral-7b-instruct-v0.1":  { vision: false, tier: "fast",    label: "Mistral 7B"             },
};

export function getModelInfo(modelId) {
  return MODEL_INFO[modelId] || { vision: false, tier: "fast", label: modelId };
}

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

  // ── OpenAI ──
  if (provider === "openai") {
    const messages = [];
    if (system) messages.push({ role:"system", content:system });
    const userContent = imageBase64
      ? [{ type:"image_url", image_url:{ url:`data:${imageMime||"image/jpeg"};base64,${imageBase64}` } }, { type:"text", text:userMessage }]
      : userMessage;
    messages.push({ role:"user", content:userContent });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
      body: JSON.stringify({ model:actualModel, max_tokens:maxTokens, messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // ── Groq ──
  if (provider === "groq") {
    const messages = [];
    if (system) messages.push({ role:"system", content:system });
    const isVision = actualModel.includes("vision");
    const userContent = (imageBase64 && isVision)
      ? [{ type:"image_url", image_url:{ url:`data:${imageMime||"image/jpeg"};base64,${imageBase64}` } }, { type:"text", text:userMessage }]
      : imageBase64
        ? `${userMessage}\n[Image provided but this model doesn't support vision — switch to a vision model]`
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
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${key}`, "HTTP-Referer":"https://grind-site.web.app", "X-Title":"GRIND" },
      body: JSON.stringify({ model:actualModel, max_tokens:maxTokens, messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenRouter ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // ── Cloudflare Workers AI ──
  if (provider === "cloudflare") {
    const [accountId, apiToken] = key.split("|");
    if (!accountId?.trim() || !apiToken?.trim())
      throw new Error('Cloudflare key must be "ACCOUNT_ID|API_TOKEN"');

    const messages = [];
    if (system) messages.push({ role:"system", content:system });
    const isVisionModel = actualModel.includes("vision");
    const userContent = (imageBase64 && isVisionModel)
      ? [{ type:"image_url", image_url:{ url:`data:${imageMime||"image/jpeg"};base64,${imageBase64}` } }, { type:"text", text:userMessage }]
      : imageBase64
        ? `${userMessage}\n[Image provided but this model doesn't support vision]`
        : userMessage;
    messages.push({ role:"user", content:userContent });

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/ai/run/${actualModel}`,
      {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":`Bearer ${apiToken.trim()}` },
        body: JSON.stringify({ messages, max_tokens:maxTokens }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.errors?.[0]?.message || `Cloudflare AI ${res.status}`);
    }
    const data = await res.json();
    return data.result?.response || "";
  }

  throw new Error(`Provider ${provider} not implemented`);
}

// ── Test key ───────────────────────────────────────────────────────────────
export async function testKey(provider, key, model) {
  const prev = getAIConfig();
  saveAIConfig({ provider, key, model });
  try {
    const result = await callAI({ system:"You are a test.", userMessage:"Reply with exactly: OK", maxTokens:10 });
    return result.trim().includes("OK") || result.trim().length > 0;
  } catch(e) {
    throw e;
  } finally {
    if (prev) saveAIConfig(prev);
    else clearAIConfig();
  }
}
