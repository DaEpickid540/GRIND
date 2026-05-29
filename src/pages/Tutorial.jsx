// Step-by-step tutorial: how to get an API key for each provider
import { useState } from "react";
import { PROVIDERS } from "../lib/aiProvider";

const TUTORIALS = [
  // ── Groq (Free + fast, best free option) ─────────────────────────────
  {
    id: "groq",
    icon: "⚡",
    title: "Groq",
    badge: "FREE",
    badgeColor: "#00FF88",
    summary: "Insanely fast inference, very generous free tier. Best free option for chat & weekly plans. Limited vision support.",
    steps: [
      { title: "Go to console.groq.com", body: "Visit https://console.groq.com — sign up free with Google, GitHub, or email." },
      { title: "Click 'API Keys' in the left sidebar", body: "It's the key icon. Or go directly to https://console.groq.com/keys" },
      { title: "Click 'Create API Key'", body: "Give it a name like 'GRIND App' so you can identify it later." },
      { title: "Copy the key starting with gsk_...", body: "⚠️ You can only see it once. Copy it immediately and paste into GRIND settings." },
      { title: "In GRIND: open Settings → AI Provider", body: "Pick 'Groq', paste the key, hit 'Test Key', then 'Save'. You're done." },
    ],
    pricing: "Free tier: ~30 requests/minute, ~14,400/day. No credit card required.",
    bestModel: "llama-3.3-70b-versatile",
  },

  // ── Gemini (Free, students 18+ extra goodies) ────────────────────────
  {
    id: "gemini",
    icon: "🔵",
    title: "Google Gemini",
    badge: "FREE",
    badgeColor: "#4DC9FF",
    summary: "Strong free tier (15 req/min), full vision support, smart for the price. Best free choice if you want photo features (nutrition scan, outfit, etc.).",
    studentBonus: true,
    steps: [
      { title: "Go to aistudio.google.com/app/apikey", body: "Sign in with your Google account (a personal Gmail is best — school accounts may be blocked)." },
      { title: "Click 'Create API key'", body: "Pick 'Create API key in new project' if you don't already have a Google Cloud project." },
      { title: "Copy the key starting with AIza...", body: "Paste it directly into GRIND. The Gemini key is shown again later if you lose it, unlike Groq." },
      { title: "In GRIND: Settings → AI Provider → Google Gemini", body: "Default model 'gemini-2.0-flash' is fast and free. 'gemini-1.5-pro' is smarter but stricter rate limits." },
    ],
    pricing: "Free tier: 15 requests/min, 1500/day on Flash. Stricter on Pro.",
    bestModel: "gemini-2.0-flash",
    studentInfo: {
      title: "🎓 If you're 18+: Free Gemini Pro",
      body: "Google offers Gemini Advanced free for one year to college students 18+ in the US. Visit gemini.google.com/students and sign up with your .edu email. This is for the Gemini Advanced chat product — for API access, you still use the AI Studio key above, but the heads-up: if you're 18 or older with a .edu, you can also use Gemini chat free in the browser separately from this app.",
    },
  },

  // ── OpenRouter (Free + paid mix) ──────────────────────────────────────
  {
    id: "openrouter",
    icon: "🔀",
    title: "OpenRouter",
    badge: "FREE OPTIONS",
    badgeColor: "#B84DFF",
    summary: "One key, 100+ models. Many free models available (Llama, Mistral, DeepSeek). Use this if you want to experiment with different models without separate keys.",
    steps: [
      { title: "Sign up at openrouter.ai", body: "Use any email or sign in with Google. No credit card needed for free models." },
      { title: "Go to Keys: openrouter.ai/keys", body: "Click 'Create Key', name it 'GRIND'." },
      { title: "Copy the key starting with sk-or-v1-...", body: "Free models include 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free', and more — but their availability fluctuates." },
      { title: "In GRIND: Settings → AI Provider → OpenRouter", body: "If you want to try a free model not in the default list, you can paste a custom model ID into the model field." },
    ],
    pricing: "Free models: free. Paid models: pay-per-use (cents per million tokens), no monthly fee.",
    bestModel: "deepseek/deepseek-r1:free",
  },

  // ── DeepSeek (cheap paid) ────────────────────────────────────────────
  {
    id: "deepseek",
    icon: "🐳",
    title: "DeepSeek",
    badge: "CHEAP",
    badgeColor: "#FFD700",
    summary: "Not directly supported as a provider yet — use it through OpenRouter (model: 'deepseek/deepseek-r1'). One of the smartest models out there and very cheap.",
    steps: [
      { title: "Use OpenRouter (see above) and select a DeepSeek model", body: "DeepSeek's direct API works with the OpenAI SDK format, but for now use OpenRouter for the simplest integration." },
      { title: "In GRIND settings, choose OpenRouter as provider", body: "Then enter 'deepseek/deepseek-r1' or 'deepseek/deepseek-r1:free' as the model name." },
    ],
    pricing: "Free via OpenRouter free tier, or ~$0.50 per million input tokens.",
    bestModel: "deepseek/deepseek-r1 (via OpenRouter)",
    proxyVia: "openrouter",
  },

  // ── OpenAI (paid) ────────────────────────────────────────────────────
  {
    id: "openai",
    icon: "💚",
    title: "OpenAI",
    badge: "PAID",
    badgeColor: "#FF9800",
    summary: "Not directly supported as a provider yet — use through OpenRouter (model: 'openai/gpt-4o-mini' or 'openai/gpt-4o').",
    steps: [
      { title: "Sign up at platform.openai.com", body: "Note: as of early 2025, OpenAI no longer offers a free credit on new accounts. You need to add a payment method." },
      { title: "Go to platform.openai.com/api-keys", body: "Create a key starting with sk-..." },
      { title: "Use OpenRouter for the easy integration", body: "Get an OpenRouter key (see above), pick model 'openai/gpt-4o-mini'. This routes through OpenRouter so we don't need a separate OpenAI integration in GRIND." },
    ],
    pricing: "Pay-per-use. GPT-4o-mini ~$0.15 per million input tokens (very cheap). GPT-4o is much more.",
    bestModel: "openai/gpt-4o-mini (via OpenRouter)",
    proxyVia: "openrouter",
  },

  // ── Anthropic (paid, native) ─────────────────────────────────────────
  {
    id: "anthropic",
    icon: "🟠",
    title: "Anthropic Claude",
    badge: "PAID — BEST QUALITY",
    badgeColor: "#FF6B35",
    summary: "Highest quality across all features (especially vision). Paid only, but cheap for the quality you get. Native integration in GRIND.",
    steps: [
      { title: "Sign up at console.anthropic.com", body: "You'll need to add a payment method and put $5+ on the account to start." },
      { title: "Go to Settings → API Keys", body: "Direct link: https://console.anthropic.com/settings/keys" },
      { title: "Click 'Create Key', name it 'GRIND'", body: "Copy the key starting with sk-ant-api03-... — you only see it once." },
      { title: "In GRIND: Settings → AI Provider → Anthropic", body: "Default model 'claude-sonnet-4-20250514' is the sweet spot of price and quality. 'claude-haiku-4-5' is cheaper and faster but less smart." },
    ],
    pricing: "Sonnet ~$3 / million input tokens. Most users spend $1-5/month on this app.",
    bestModel: "claude-sonnet-4-20250514",
  },
];

const CLOUDFLARE_NOTE = {
  icon: "☁️",
  title: "Cloudflare Workers AI",
  body: "Cloudflare offers free LLM inference with Llama, Mistral, and others on their Workers platform. It's powerful but requires writing a Cloudflare Worker that proxies their AI API into an OpenAI-compatible chat completions endpoint. GRIND doesn't have a native integration yet — to use it, you'd deploy a worker (~30 lines of code, free tier covers heavy use) and then add it as a custom OpenRouter-style endpoint. If you're comfortable with Cloudflare, this is the most cost-effective long-term play. Docs: developers.cloudflare.com/workers-ai",
};

export default function Tutorial() {
  const [open, setOpen] = useState("groq"); // open the free best option by default

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🎓 Setup Tutorial</h1><p className="page-sub">How to get an AI API key. Several free options — pick what fits.</p></div>
      </div>

      {/* The big upfront warning */}
      <div className="tutorial-warning">
        <div style={{ fontSize:24 }}>⚠️</div>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:"#FF9800" }}>Free models are weaker than paid models.</div>
          <div style={{ fontSize:13, color:"#aaa", marginTop:3 }}>
            Free providers (Groq, Gemini Flash, free OpenRouter models) work fine for daily check-ins, weekly plans, and basic nutrition. For sharper outfit critiques, deeper physique analysis, and the smartest weekly plans, paid models (Claude Sonnet, GPT-4o, Gemini Pro) are noticeably better. You can switch anytime in Settings.
          </div>
        </div>
      </div>

      {/* Quick comparison */}
      <div className="tutorial-compare">
        <h3 className="section-sub-title" style={{ marginBottom:10 }}>Which one should I pick?</h3>
        <div className="compare-grid">
          {[
            { label: "Best free option (speed)",  pick: "Groq",        why: "Llama 3.3 70B, super fast" },
            { label: "Best free with vision",     pick: "Gemini Flash", why: "Free vision for nutrition/outfit scans" },
            { label: "Most flexible / experiment", pick: "OpenRouter",  why: "Try 100+ models, many free" },
            { label: "Best quality (paid)",       pick: "Anthropic",   why: "Claude Sonnet — sharpest voice" },
            { label: "Cheap paid",                pick: "DeepSeek (via OpenRouter)", why: "Smart, ~$0.50/M tokens" },
          ].map(row => (
            <div key={row.label} className="compare-row">
              <span style={{ color:"#888" }}>{row.label}</span>
              <span style={{ color:"#FFD700", fontWeight:700 }}>{row.pick}</span>
              <span style={{ color:"#666", fontSize:12 }}>{row.why}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tutorial accordion */}
      <div className="tutorial-list">
        {TUTORIALS.map(t => {
          const isOpen = open === t.id;
          return (
            <div key={t.id} className={`tutorial-item ${isOpen?"open":""}`}>
              <button className="tutorial-header" onClick={() => setOpen(isOpen ? null : t.id)}>
                <span style={{ fontSize:28 }}>{t.icon}</span>
                <div style={{ flex:1, textAlign:"left" }}>
                  <div style={{ fontWeight:700, fontSize:16 }}>{t.title}</div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{t.summary}</div>
                </div>
                <span className="tutorial-badge" style={{ borderColor:t.badgeColor, color:t.badgeColor }}>{t.badge}</span>
                <span className="tutorial-chevron">{isOpen?"▼":"▶"}</span>
              </button>

              {isOpen && (
                <div className="tutorial-body">
                  <ol className="tutorial-steps">
                    {t.steps.map((step, i) => (
                      <li key={i}>
                        <div className="step-title">{step.title}</div>
                        <div className="step-body">{step.body}</div>
                      </li>
                    ))}
                  </ol>

                  <div className="tutorial-meta">
                    <div><span style={{ color:"#888" }}>Pricing:</span> {t.pricing}</div>
                    <div><span style={{ color:"#888" }}>Best model:</span> <code>{t.bestModel}</code></div>
                  </div>

                  {t.studentBonus && t.studentInfo && (
                    <div className="student-bonus">
                      <div style={{ fontWeight:700, fontSize:13, color:"#00FF88" }}>{t.studentInfo.title}</div>
                      <div style={{ fontSize:13, color:"#aaa", marginTop:4, lineHeight:1.5 }}>{t.studentInfo.body}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Cloudflare note */}
        <div className="tutorial-item">
          <div className="tutorial-header" style={{ cursor:"default" }}>
            <span style={{ fontSize:28 }}>{CLOUDFLARE_NOTE.icon}</span>
            <div style={{ flex:1, textAlign:"left" }}>
              <div style={{ fontWeight:700, fontSize:16 }}>{CLOUDFLARE_NOTE.title}</div>
              <div style={{ fontSize:13, color:"#aaa", marginTop:6, lineHeight:1.5 }}>{CLOUDFLARE_NOTE.body}</div>
            </div>
            <span className="tutorial-badge" style={{ borderColor:"#888", color:"#888" }}>ADVANCED</span>
          </div>
        </div>
      </div>

      {/* Closing call to action */}
      <div className="tutorial-cta">
        <h3 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:1, marginBottom:6 }}>Ready?</h3>
        <p style={{ color:"#888", fontSize:14, marginBottom:12 }}>Open Settings (⌘,) → AI Provider tab → paste your key.</p>
      </div>
    </div>
  );
}
