import { useState, useEffect } from "react";
import {
  Bot, Search, Brain, Dna, Palette, CheckSquare, Gamepad2, Bell, Save, User,
  Settings as SettingsIcon, X, Eye, EyeOff, Camera, Zap, AlertTriangle,
  Moon, Sun, Monitor, Pencil, Droplet, Package, Trash2, Flame, Loader2, Award,
  Compass, Globe, Shield, Sparkles, Utensils, Dumbbell, Scale, BedDouble,
  PersonStanding, Move, Footprints, Wind, Star,
} from "lucide-react";

// Data-sourced emoji (knowledgeBase.js categories, reminders.js list) can't
// carry a JSX icon in their own data — look the icon up by id instead of
// rendering the emoji field directly.
const KB_CAT_ICONS = { nutrition: Utensils, training: Dumbbell, bodyComp: Scale, recovery: BedDouble, mindset: Brain };
const REMINDER_ICONS = { water: Droplet, posture: PersonStanding, stretch: Move, eyes: Eye, move: Footprints, breath: Wind };
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/userSettings";
import { PROVIDERS, MODEL_INFO, getModelInfo, getAIConfig, saveAIConfig, clearAIConfig, testKey, getProviderKey, getConfiguredProviders, clearProviderKey } from "../lib/aiProvider";
import { SEARCH_PROVIDERS, providerNeedsKey, getSearchConfig, saveSearchConfig, clearSearchConfig } from "../lib/searchProvider";
import {
  KB_CATEGORIES, KNOWLEDGE_BASE, getKBConfig, getCategoryMultiplier,
  setCategoryMultiplier, addCustomFact, removeCustomFact,
} from "../lib/knowledgeBase";
import { HABIT_CATEGORIES } from "../data/gameData";
import { useAuth } from "../hooks/useAuth";
import { logout, updateUserProfile, getCheckinHistory, uploadProfilePhoto, enablePushNotifications, updateReminderPrefs } from "../lib/firebase";
import { useToast } from "./Toast";

const TABS = [
  { id:"ai",       icon:Bot,         label:"AI Provider"    },
  { id:"search",   icon:Search,      label:"Search"         },
  { id:"knowledge",icon:Brain,       label:"Knowledge"      },
  { id:"profile",  icon:Dna,         label:"Your Profile"   },
  { id:"appear",   icon:Palette,     label:"Appearance"     },
  { id:"habits",   icon:CheckSquare, label:"Habits"         },
  { id:"game",     icon:Gamepad2,    label:"Gamification"   },
  { id:"notifs",   icon:Bell,        label:"Notifications"  },
  { id:"data",     icon:Save,        label:"Data"           },
  { id:"account",  icon:User,        label:"Account"        },
];

// Explicit per-provider icons — a lookup (not a ternary chain) so a new provider
// gets the generic Search glyph instead of inheriting whatever fell through last.
const SEARCH_PROV_ICONS = {
  tavily:      Sparkles,
  contextwire: Compass,
  duckduckgo:  Globe,
  serpapi:     Search,
  brave:       Shield,
};

const ACCENT_PRESETS = [
  { label:"Gold",    value:"#D4A017" },
  { label:"Red",     value:"#FF4D4D" },
  { label:"Blue",    value:"#4DC9FF" },
  { label:"Green",   value:"#00FF88" },
  { label:"Purple",  value:"#B84DFF" },
  { label:"Orange",  value:"#FF9800" },
  { label:"Pink",    value:"#FF69B4" },
  { label:"White",   value:"#E8E8E8" },
];

export default function SettingsModal({ onClose, onResetKey, initialTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  // initialTab lets the AI sidebar deep-link straight to a tab ("open Settings
  // → AI"); falls back to the AI tab for a normal manual open.
  const [tab, setTab] = useState(() => TABS.some(t => t.id === initialTab) ? initialTab : "ai");
  const [settings, setSettings] = useState(getSettings());

  // AI tab state
  const aiCfg = getAIConfig();
  const [aiProvider, setAiProvider] = useState(aiCfg?.provider || "anthropic");
  const [aiKey,      setAiKey]      = useState(aiCfg?.key || "");
  const [aiModel,    setAiModel]    = useState(aiCfg?.model || PROVIDERS["anthropic"].defaultModel);
  const [showKey,    setShowKey]    = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [verified,   setVerified]   = useState(false);
  const [keyError,   setKeyError]   = useState("");
  const [configuredProviders, setConfiguredProviders] = useState(getConfiguredProviders());

  // Search tab state
  const searchCfg = getSearchConfig();
  const [searchProvider, setSearchProvider] = useState(searchCfg?.provider || "tavily");
  const [searchKey,      setSearchKey]      = useState(searchCfg?.key || "");
  const [searchEnabled,  setSearchEnabled]  = useState(!!searchCfg?.enabled);
  const [showSearchKey,  setShowSearchKey]  = useState(false);

  // Active categories — user's custom ones from Firestore, or the generic defaults
  const activeCategories = profile?.customHabits || HABIT_CATEGORIES;

  // Data tab state
  const [exporting,  setExporting]  = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast("Image too large (max 5MB)", "warning"); return; }
    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(user.uid, file);
      await refreshProfile();
      toast("Profile photo updated! 📸", "success");
    } catch(err) {
      toast("Upload failed — is Firebase Storage enabled?", "error");
      console.error(err);
    } finally { setUploadingPhoto(false); }
  }

  async function handleStreakReminderToggle(enabled) {
    update("streakReminderEnabled", enabled);
    if (!user) return;
    if (enabled) {
      try {
        const hour = parseInt((settings.streakReminderTime || "21:00").split(":")[0], 10);
        await enablePushNotifications(user.uid, hour);
        toast("Push notifications enabled 🔔", "success");
      } catch(err) {
        toast(err.message || "Couldn't enable push", "error");
        update("streakReminderEnabled", false);
      }
    } else {
      await updateReminderPrefs(user.uid, false, parseInt((settings.streakReminderTime||"21:00").split(":")[0],10));
      toast("Reminders disabled", "info");
    }
  }

  async function syncReminderTime(timeStr) {
    if (!user || !settings.streakReminderEnabled) return;
    const hour = parseInt(timeStr.split(":")[0], 10);
    await updateReminderPrefs(user.uid, true, hour);
  }
  const [clearingData, setClearingData] = useState(false);
  const [confirmReset, setConfirmReset] = useState("");

  function update(key, val) {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
  }

  // ── AI tab ──────────────────────────────────────────────────────────────
  // Switching tabs just changes which provider's form is showing — it doesn't
  // touch storage. If that provider already has a saved key, pre-fill it
  // instead of showing a blank field (this is what used to silently wipe
  // other providers' keys when you clicked Save on a different tab).
  function switchProvider(p) {
    setAiProvider(p);
    const saved = getProviderKey(p);
    setAiModel(saved?.model || PROVIDERS[p].defaultModel);
    setAiKey(saved?.key || "");
    setVerified(false); setKeyError("");
  }

  async function handleTestKey() {
    if (!aiKey.trim()) { setKeyError("Enter a key first."); return; }
    setTesting(true); setKeyError(""); setVerified(false);
    try {
      await testKey(aiProvider, aiKey.trim(), aiModel);
      setVerified(true);
      toast("Key verified ✅", "success");
    } catch(e) {
      setKeyError(`Failed: ${e.message}`);
      toast("Key test failed", "error");
    } finally { setTesting(false); }
  }

  function saveAI() {
    if (!aiKey.trim()) { setKeyError("Enter a key first."); return; }
    saveAIConfig({ provider:aiProvider, key:aiKey.trim(), model:aiModel });
    setConfiguredProviders(getConfiguredProviders());
    toast(`${PROVIDERS[aiProvider].name} saved ✅`, "success");
  }

  // Clears whichever provider's tab is currently open — not every saved key.
  // Only forces the blocking "connect an AI" modal if that leaves nothing
  // configured at all; if another provider still has a saved key, the app
  // just falls back to that one.
  function clearAI() {
    clearProviderKey(aiProvider);
    setConfiguredProviders(getConfiguredProviders());
    setAiKey(""); setVerified(false); setKeyError("");
    toast(`${PROVIDERS[aiProvider].name} key cleared`, "warning");
    if (!getAIConfig()) onResetKey?.();
  }

  // ── Search tab ──────────────────────────────────────────────────────────
  function updateSearchCfg(patch) {
    const next = { provider: searchProvider, key: searchKey, enabled: searchEnabled, ...patch };
    if ("provider" in patch) setSearchProvider(patch.provider);
    if ("key"      in patch) setSearchKey(patch.key);
    if ("enabled"  in patch) setSearchEnabled(patch.enabled);
    saveSearchConfig(next);
  }

  function saveSearch() {
    const p = SEARCH_PROVIDERS[searchProvider];
    const needsKey = providerNeedsKey(p);
    if (needsKey && !searchKey.trim()) { toast("Enter an API key first", "warning"); return; }
    // Keep any typed key even for keyless providers — switching back shouldn't lose it.
    updateSearchCfg({ key: searchKey.trim() });
    toast(needsKey ? `${p?.label || "Search"} key saved ✅` : `${p?.label || "Search"} saved — no key needed ✅`, "success");
  }

  function clearSearch() {
    clearSearchConfig();
    setSearchKey(""); setSearchEnabled(false);
    toast("Search settings cleared", "warning");
  }

  // ── Data tab ─────────────────────────────────────────────────────────
  async function exportData() {
    if (!user) return;
    setExporting(true);
    try {
      const history = await getCheckinHistory(user.uid);
      const blob = new Blob([JSON.stringify({
        exportedAt: new Date().toISOString(),
        profile,
        checkins: history,
        settings,
        customHabits: activeCategories,
      }, null, 2)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = `grind-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast("Data exported!", "success");
    } catch(e) { toast("Export failed", "error"); }
    finally { setExporting(false); }
  }

  async function resetXP() {
    if (confirmReset !== "RESET") { toast('Type "RESET" to confirm', "warning"); return; }
    await updateUserProfile(user.uid, { xp:0, level:1, streak:0, longestStreak:0, lastCheckIn:null });
    await refreshProfile();
    setConfirmReset("");
    toast("Progress reset. Fresh start. 💪", "success");
  }

  function resetAppearance() {
    const next = {
      ...settings,
      theme: DEFAULT_SETTINGS.theme,
      accentColor: DEFAULT_SETTINGS.accentColor,
      fontSize: DEFAULT_SETTINGS.fontSize,
      compactMode: false,
      animationsEnabled: true,
    };
    setSettings(next);
    saveSettings(next);
    toast("Appearance reset to defaults", "success");
  }

  const prov = PROVIDERS[aiProvider];
  const activeAI = getAIConfig();
  const searchProv     = SEARCH_PROVIDERS[searchProvider];
  const searchNeedsKey = providerNeedsKey(searchProv);
  const activeSearchProv = SEARCH_PROVIDERS[searchCfg?.provider];
  const searchLive = !!searchCfg?.enabled && !!activeSearchProv &&
    (!!searchCfg?.key || !providerNeedsKey(activeSearchProv));

  return (
    <div className="settings-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title" style={{ display:"inline-flex", alignItems:"center", gap:8 }}><SettingsIcon size={20}/> Settings</h2>
          <button className="settings-close" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="settings-body">
          {/* Sidebar tabs */}
          <div className="settings-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`settings-tab ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>
                <t.icon className="stab-icon" size={16}/>
                <span className="stab-label">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="settings-content">

            {/* ── AI PROVIDER ── */}
            {tab==="ai" && (
              <div className="sform">
                <div className="sform-title">AI Provider</div>
                <p className="sform-sub">Connect your own API key. Stored on this device only.</p>

                {activeAI && (
                  <div className="active-badge">
                    <img src={PROVIDERS[activeAI.provider]?.icon} alt="" className="prov-logo-sm"/>
                    <span style={{ color:PROVIDERS[activeAI.provider]?.color }}>{PROVIDERS[activeAI.provider]?.name}</span>
                    <span className="active-badge-model">{activeAI.model}</span>
                    <span className="live-dot"/>
                  </div>
                )}

                <div className="provider-grid">
                  {Object.entries(PROVIDERS).map(([id,p]) => (
                    <button key={id} className={`prov-btn ${aiProvider===id?"active":""}`}
                      style={{ "--pc":p.color }} onClick={() => switchProvider(id)}
                      title={configuredProviders.includes(id) && activeAI?.provider!==id ? "Key saved — not currently active" : undefined}>
                      <span className="prov-logo-chip"><img src={p.icon} alt="" className={p.iconMono ? "mono" : undefined}/></span>
                      <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
                      {activeAI?.provider===id && <span className="prov-live"/>}
                      {activeAI?.provider!==id && configuredProviders.includes(id) && <span className="prov-saved"/>}
                    </button>
                  ))}
                </div>

                <div className="srow">
                  <label className="slabel">Model</label>
                  <a href={prov.url} target="_blank" rel="noopener noreferrer" className="slink">
                    {prov.freeKey ? "Get free key →" : "Get API key →"}
                  </a>
                </div>
                <select className="sinp" value={aiModel} onChange={e=>{setAiModel(e.target.value);setVerified(false);}}>
                  {prov.models.map(m => {
                    const info = getModelInfo(m);
                    const visionTag = info.vision ? " · 👁 vision" : " · text only";
                    const tierTag   = info.tier === "best" ? " ★" : info.tier === "fastest" ? " ⚡" : "";
                    return <option key={m} value={m}>{info.label}{visionTag}{tierTag}</option>;
                  })}
                </select>

                {/* Vision capability warning */}
                {getModelInfo(aiModel).vision === false && (
                  <div className="model-vision-warn">
                    <Camera size={14} style={{ verticalAlign:"-2px" }}/> <strong>No vision support</strong> — AI Scans, Calorie Counter, and Outfit Analyzer
                    won't work with this model. Pick a <em><Eye size={13} style={{ verticalAlign:"-2px" }}/> vision</em> model above to use those features.
                  </div>
                )}
                {getModelInfo(aiModel).tier === "fastest" && (
                  <div className="model-tier-note">
                    <Zap size={14} style={{ verticalAlign:"-2px" }}/> Small/fast model — may be less accurate for calorie estimates and detailed outfit analysis.
                    A ★ model gives better results for visual tasks.
                  </div>
                )}
                {getModelInfo(aiModel).vision === true && getModelInfo(aiModel).tier === "fast" && (
                  <div className="model-tier-note model-tier-ok">
                    <Eye size={14} style={{ verticalAlign:"-2px" }}/> Vision supported — AI Scans will work. For highest accuracy on nutrition &amp; outfits,
                    a ★ model is recommended.
                  </div>
                )}

                <label className="slabel" style={{ marginTop:14 }}>API Key</label>
                <div className="key-wrap">
                  <input className="sinp key-field" type={showKey?"text":"password"}
                    placeholder={prov.placeholder} value={aiKey}
                    onChange={e=>{setAiKey(e.target.value);setVerified(false);setKeyError("");}}
                    onPaste={e=>{e.preventDefault();setAiKey(e.clipboardData.getData("text").trim());setVerified(false);setKeyError("");}}/>
                  <button className="key-vis" onClick={()=>setShowKey(s=>!s)}>{showKey?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                </div>
                {prov.keyHint && <div className="key-hint">{prov.keyHint}</div>}
                {keyError && <div className="serr">{keyError}</div>}
                {verified && <div className="sok" style={{ display:"flex", alignItems:"center", gap:5 }}><CheckSquare size={13}/> Key verified and working</div>}

                <div className="sprov-note">
                  {aiProvider==="anthropic"  && "Best quality for all features incl. vision. Paid only — no free tier."}
                  {aiProvider==="gemini"     && "Free tier available (15 req/min). All Gemini models support vision."}
                  {aiProvider==="openai"     && "Pay-per-use. GPT-4o and GPT-4o Mini both support vision."}
                  {aiProvider==="groq"       && "Very generous free tier. Vision only on the Qwen3.6 27B model."}
                  {aiProvider==="openrouter" && "100+ models, many free options. Vision depends on chosen model."}
                  {aiProvider==="cloudflare" && "Free tier via Workers AI. Enter Account ID and API Token separated by |."}
                </div>

                <div className="sbtn-row">
                  <button className="sbtn-test" onClick={handleTestKey} disabled={testing||!aiKey.trim()}>
                    {testing?"Testing…":"Test Key"}
                  </button>
                  <button className="sbtn-save" onClick={saveAI} disabled={!aiKey.trim()}>Save</button>
                  {configuredProviders.includes(aiProvider) && <button className="sbtn-danger" onClick={clearAI}>Clear</button>}
                </div>

                <p className="icon-credit">
                  Provider icons by <a href="https://lobehub.com/icons" target="_blank" rel="noopener noreferrer">LobeHub Icons</a>
                </p>
              </div>
            )}

            {/* ── INTERNET SEARCH ── */}
            {tab==="search" && (
              <div className="sform">
                <div className="sform-title">Internet Search</div>
                <p className="sform-sub">
                  Let the AI ground its answers in live web results — current events, recent
                  research, today's prices. Pick a provider — most need an API key, DuckDuckGo doesn't.
                  Keys are stored on this device only.
                </p>

                {searchLive && (
                  <div className="active-badge">
                    <span style={{ color:"var(--accent)" }}>{activeSearchProv.label}</span>
                    <span className="active-badge-model">
                      {activeSearchProv.needsProxy ? "key saved · proxy needed"
                        : activeSearchProv.id==="duckduckgo" ? "active · definitions only" : "active"}
                    </span>
                    <span className="live-dot"/>
                  </div>
                )}

                <div className="toggle-rows" style={{ marginBottom:18 }}>
                  <ToggleRow label="Enable web search" sub="Let AI features pull in live results when it's relevant"
                    value={searchEnabled} onChange={v => updateSearchCfg({ enabled: v })}/>
                </div>

                <label className="slabel">Provider</label>
                <div className="provider-grid">
                  {Object.values(SEARCH_PROVIDERS).map(p => {
                    const PIcon = SEARCH_PROV_ICONS[p.id] || Search;
                    return (
                    <button key={p.id} className={`prov-btn ${searchProvider===p.id?"active":""}`}
                      onClick={() => updateSearchCfg({ provider: p.id })}>
                      <PIcon size={24}/>
                      <span style={{ fontWeight:700, fontSize:13 }}>
                        {p.label}
                        {p.recommended && <span className="rec-badge"><Star size={9} style={{ verticalAlign:"-1px" }}/> Recommended</span>}
                        {!providerNeedsKey(p) && <span className="rec-badge">No key</span>}
                      </span>
                      {searchCfg?.provider===p.id && searchCfg?.enabled && <span className="prov-live"/>}
                    </button>
                    );
                  })}
                </div>

                {searchProv && (
                  <>
                    <p className="sform-hint" style={{ marginTop:10 }}>{searchProv.desc}</p>

                    {searchProv.needsProxy && (
                      <div className="model-vision-warn">
                        ⚠️ <strong>{searchProv.label} blocks direct browser requests (CORS)</strong> — to actually
                        run searches through it from GRIND, a small server-side proxy (e.g. a Firebase Cloud
                        Function that forwards the request and attaches your key) would need to be deployed first.
                        You can still save your key here for when that's wired up, but live searches won't run
                        through {searchProv.label} directly from the browser yet.
                        <strong> Tavily works today with just a key — or DuckDuckGo with no key at all.</strong>
                      </div>
                    )}

                    {searchNeedsKey && (
                      <>
                        <label className="slabel" style={{ marginTop:14 }}>API Key</label>
                        <div className="key-wrap">
                          <input className="sinp key-field" type={showSearchKey?"text":"password"}
                            placeholder="Paste your API key…" value={searchKey}
                            onChange={e => setSearchKey(e.target.value)}
                            onPaste={e => { e.preventDefault(); setSearchKey(e.clipboardData.getData("text").trim()); }}/>
                          <button className="key-vis" onClick={() => setShowSearchKey(s=>!s)}>{showSearchKey?<EyeOff size={15}/>:<Eye size={15}/>}</button>
                        </div>
                        <div className="key-hint">
                          {searchProv.keyHelp}{" "}
                          <a href={`https://${searchProv.site}`} target="_blank" rel="noopener noreferrer" className="slink">{searchProv.site} →</a>
                        </div>
                      </>
                    )}

                    <div className="sprov-note">
                      {searchProv.id==="tavily"      && "Search API built for AI apps — real general web results with citations, callable straight from the browser. Free tier at tavily.com; keys start with tvly-."}
                      {searchProv.id==="contextwire" && "Multi-source research engine with no LLM lock-in — built for client apps, works directly from the browser, free tier available."}
                      {searchProv.id==="duckduckgo"  && "Free and keyless, but it's DuckDuckGo's Instant Answer API — not a live web search. It answers \"what is X\" style lookups (creatine, BMI, intermittent fasting) and returns nothing at all for open-ended questions like \"best protein intake 2026\"."}
                      {searchProv.id==="serpapi"     && "Structured Google/Bing/DuckDuckGo results as JSON. Needs a proxy to call from a hosted browser app."}
                      {searchProv.id==="brave"       && "Independent search index with a generous free tier and a privacy-first stance. Needs a proxy to call from a hosted browser app."}
                    </div>

                    <div className="sbtn-row">
                      <button className="sbtn-save" onClick={saveSearch} disabled={searchNeedsKey && !searchKey.trim()}>Save</button>
                      {(searchCfg?.key || searchKey || !searchNeedsKey) && <button className="sbtn-danger" onClick={clearSearch}>Clear</button>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── KNOWLEDGE BASE (curated RAG-style grounding) ── */}
            {tab==="knowledge" && (
              <KnowledgeTab toast={toast}/>
            )}

            {/* ── PROFILE (Onboarding data) ── */}
            {tab==="profile" && (
              <ProfileTab user={user} toast={toast}/>
            )}

            {/* ── APPEARANCE ── */}
            {tab==="appear" && (
              <div className="sform">
                <div className="sform-title">Appearance</div>
                <p className="sform-sub">Customize the look and feel of GRIND.</p>

                <label className="slabel">Theme</label>
                <div className="seg-ctrl">
                  {[
                    { id:"dark",  icon:Moon,    label:"Dark"  },
                    { id:"light", icon:Sun,     label:"Light" },
                    { id:"auto",  icon:Monitor, label:"Auto"   },
                  ].map(t => (
                    <button key={t.id} className={`seg-btn ${(settings.theme||"dark")===t.id?"active":""}`}
                      onClick={() => update("theme", t.id)} style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
                      <t.icon size={13}/>{t.label}
                    </button>
                  ))}
                </div>
                <p className="sform-hint" style={{ marginTop:6 }}>
                  "Auto" follows your system's light/dark preference.
                </p>

                <label className="slabel" style={{ marginTop:20 }}>Accent Color</label>
                <div className="color-grid">
                  {ACCENT_PRESETS.map(c => (
                    <button key={c.value} className={`color-swatch ${settings.accentColor===c.value?"active":""}`}
                      style={{ background:c.value, "--cc":c.value }} title={c.label}
                      onClick={() => update("accentColor", c.value)}>
                      {settings.accentColor===c.value && <span className="color-check">✓</span>}
                    </button>
                  ))}
                  <label className="color-custom" title="Custom color">
                    <input type="color" value={settings.accentColor}
                      onChange={e => update("accentColor", e.target.value)}/>
                    <Palette size={16}/>
                  </label>
                </div>

                <label className="slabel" style={{ marginTop:20 }}>Font Size</label>
                <div className="seg-ctrl">
                  {["small","medium","large"].map(s => (
                    <button key={s} className={`seg-btn ${settings.fontSize===s?"active":""}`}
                      onClick={() => update("fontSize", s)}>
                      {s.charAt(0).toUpperCase()+s.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="toggle-rows" style={{ marginTop:20 }}>
                  <ToggleRow label="Compact Mode" sub="Tighter spacing, smaller cards"
                    value={settings.compactMode} onChange={v => update("compactMode", v)}/>
                  <ToggleRow label="Animations" sub="Rings, transitions, confetti"
                    value={settings.animationsEnabled} onChange={v => update("animationsEnabled", v)}/>
                </div>

                <button className="sbtn-ghost" onClick={resetAppearance} style={{ marginTop:20 }}>
                  Reset to defaults
                </button>
              </div>
            )}

            {/* ── HABITS ── */}
            {tab==="habits" && (
              <div className="sform">
                <div className="sform-title">Habit Categories</div>
                <p className="sform-sub">
                  Your habits are fully customizable — add categories, habits, and custom XP values.
                </p>

                <div className="habits-settings-preview">
                  {Object.entries(activeCategories).map(([id, cat]) => (
                    <div key={id} className="habit-preview-row" style={{ borderLeft:`3px solid ${cat.color}` }}>
                      <span style={{ fontSize:18 }}>{cat.icon}</span>
                      <span style={{ color:cat.color, fontWeight:700, fontSize:13 }}>{cat.label}</span>
                      <span style={{ marginLeft:"auto", fontSize:11, color:"#555" }}>
                        {cat.habits.length} habit{cat.habits.length!==1?"s":""}
                      </span>
                    </div>
                  ))}
                  {Object.keys(activeCategories).length === 0 && (
                    <p style={{ color:"#555", fontSize:13 }}>No habits configured yet.</p>
                  )}
                </div>

                <div className="sdivider"/>

                <p className="sform-sub" style={{ marginBottom:10 }}>
                  To add, edit, or remove categories and habits, use the Customize button on the Today page.
                </p>
                <button className="sbtn-save" onClick={onClose} style={{ alignSelf:"flex-start", display:"inline-flex", alignItems:"center", gap:6 }}>
                  <Pencil size={13}/> Go to Today → Customize
                </button>
              </div>
            )}

            {/* ── GAMIFICATION ── */}
            {tab==="game" && (
              <div className="sform">
                <div className="sform-title">Gamification</div>
                <p className="sform-sub">Tune the difficulty and XP system to your preference.</p>

                <div className="toggle-rows">
                  <ToggleRow label="Show XP on Habits" sub="Display +XP next to each habit checkbox"
                    value={settings.showXPOnHabits} onChange={v=>update("showXPOnHabits",v)}/>
                  <ToggleRow label="Hard Mode" sub="All habits in a category must be done for XP to count"
                    value={settings.hardMode} onChange={v=>update("hardMode",v)}/>
                </div>

                <label className="slabel" style={{ marginTop:20 }}>XP Multiplier</label>
                <div className="seg-ctrl">
                  {[0.5, 1.0, 1.5, 2.0].map(m => (
                    <button key={m} className={`seg-btn ${settings.xpMultiplier===m?"active":""}`}
                      onClick={()=>update("xpMultiplier",m)}>
                      {m}×
                    </button>
                  ))}
                </div>
                <p className="sform-sub" style={{ marginTop:6 }}>
                  {settings.xpMultiplier<1 && "Reduced XP — challenge mode."}
                  {settings.xpMultiplier===1 && "Standard XP — default."}
                  {settings.xpMultiplier===1.5 && "Boosted XP — for catching up."}
                  {settings.xpMultiplier===2 && "Double XP — party mode 🎉"}
                </p>

                <label className="slabel" style={{ marginTop:20 }}>Streak Grace Period</label>
                <div className="seg-ctrl">
                  {[0,1,2,4].map(h => (
                    <button key={h} className={`seg-btn ${settings.streakGracePeriod===h?"active":""}`}
                      onClick={()=>update("streakGracePeriod",h)}>
                      {h===0?"None":`${h}h`}
                    </button>
                  ))}
                </div>
                <p className="sform-sub" style={{ marginTop:6 }}>
                  Extra hours past midnight before your streak breaks. 0 = strict.
                </p>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {tab==="notifs" && (
              <div className="sform">
                <div className="sform-title">Notifications</div>
                <p className="sform-sub">
                  Reminder times are stored locally. Push notifications require browser permission.
                </p>

                <div className="toggle-rows">
                  <ToggleRow label="Streak Reminder" sub="Push notification if you haven't checked in"
                    value={settings.streakReminderEnabled} onChange={v=>handleStreakReminderToggle(v)}/>
                </div>
                {settings.streakReminderEnabled && (
                  <div style={{ marginTop:10, marginBottom:20 }}>
                    <label className="slabel">Reminder Time</label>
                    <input className="sinp" type="time" value={settings.streakReminderTime}
                      onChange={e=>{ update("streakReminderTime",e.target.value); syncReminderTime(e.target.value); }} style={{ width:160 }}/>
                  </div>
                )}

                <div className="toggle-rows">
                  <ToggleRow label="Daily Plan Reminder" sub="Morning nudge to check your plan"
                    value={settings.dailyPlanReminderEnabled} onChange={v=>update("dailyPlanReminderEnabled",v)}/>
                </div>
                {settings.dailyPlanReminderEnabled && (
                  <div style={{ marginTop:10 }}>
                    <label className="slabel">Reminder Time</label>
                    <input className="sinp" type="time" value={settings.dailyPlanReminderTime}
                      onChange={e=>update("dailyPlanReminderTime",e.target.value)} style={{ width:160 }}/>
                  </div>
                )}

                <div className="notif-note">
                  <AlertTriangle size={16}/>
                  <span>Browser notifications require you to grant permission. GRIND will request this the first time a reminder fires. Mobile PWA install required for background reminders.</span>
                </div>

                <div className="sdivider"/>
                <div className="sform-title" style={{ fontSize:14, display:"flex", alignItems:"center", gap:6 }}><Droplet size={15}/> Health Reminders</div>
                <p className="sform-sub">Active while the app is open. Configure intervals below.</p>
                <HealthReminders toast={toast}/>
              </div>
            )}

            {/* ── DATA ── */}
            {tab==="data" && (
              <div className="sform">
                <div className="sform-title">Your Data</div>
                <p className="sform-sub">Export or manage your GRIND data.</p>

                <div className="data-card">
                  <div className="data-card-icon"><Package size={28}/></div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>Export All Data</div>
                    <div style={{ fontSize:13, color:"#888", marginTop:2 }}>
                      Downloads a JSON file with your full check-in history, gym records, XP, and settings.
                    </div>
                  </div>
                  <button className="sbtn-save" onClick={exportData} disabled={exporting} style={{ marginLeft:"auto", flexShrink:0 }}>
                    {exporting?"Exporting…":"Export JSON"}
                  </button>
                </div>

                <div className="sdivider"/>
                <div className="sform-title" style={{ fontSize:14, color:"#FF4D4D" }}>Danger Zone</div>

                <div className="data-card danger">
                  <div className="data-card-icon"><Trash2 size={28}/></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>Reset All Progress</div>
                    <div style={{ fontSize:13, color:"#888", marginTop:2 }}>
                      Wipes your XP, level, and streak. Cannot be undone.
                    </div>
                    <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center" }}>
                      <input className="sinp" placeholder='Type "RESET" to confirm'
                        value={confirmReset} onChange={e=>setConfirmReset(e.target.value)}
                        style={{ maxWidth:220 }}/>
                      <button className="sbtn-danger" onClick={resetXP}
                        disabled={confirmReset!=="RESET"}>
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ACCOUNT ── */}
            {tab==="account" && (
              <div className="sform">
                <div className="sform-title">Account</div>

                <div className="account-card">
                  <div className="acct-avatar-wrap">
                    {(profile?.customPhotoURL || user?.photoURL)
                      ? <img src={profile?.customPhotoURL || user.photoURL} className="acct-avatar" referrerPolicy="no-referrer" alt=""/>
                      : <div className="acct-avatar placeholder">{user?.displayName?.[0]}</div>}
                    <label className="acct-photo-edit" title="Change photo">
                      {uploadingPhoto ? <Loader2 size={12}/> : <Camera size={12}/>}
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoUpload} disabled={uploadingPhoto}/>
                    </label>
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:16 }}>{user?.displayName}</div>
                    <div style={{ fontSize:13, color:"#888" }}>{user?.email}</div>
                  </div>
                </div>

                <div className="stats-mini">
                  {[
                    [Zap,        "XP",         profile?.xp||0],
                    [Flame,      "Streak",     profile?.streak||0],
                    [Award,      "Level",      profile?.level||1],
                    [CheckSquare,"Check-ins",  profile?.longestStreak||0],
                  ].map(([Icon,k,v])=>(
                    <div key={k} className="stats-mini-item">
                      <div className="smi-val">{v}</div>
                      <div className="smi-key" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:3 }}><Icon size={10}/> {k}</div>
                    </div>
                  ))}
                </div>

                <div className="sdivider"/>

                <div className="sform-title" style={{ fontSize:14 }}>Connected Services</div>
                <div className="service-row">
                  <span style={{ display:"flex", alignItems:"center", gap:6 }}><Flame size={14}/> Firebase Auth</span>
                  <span className="service-status active">Connected</span>
                </div>
                <div className="service-row">
                  <span style={{ display:"flex", alignItems:"center", gap:6 }}><Bot size={14}/> AI Provider</span>
                  {getAIConfig()
                    ? <span className="service-status active">{PROVIDERS[getAIConfig().provider]?.name}</span>
                    : <span className="service-status inactive">Not set</span>
                  }
                </div>

                <div className="sdivider"/>
                <button className="sbtn-danger-full" onClick={logout}>Sign Out</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!value)}>
      <div>
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <div className={`toggle-switch ${value?"on":""}`}>
        <div className="toggle-thumb"/>
      </div>
    </div>
  );
}

const KB_MULT_OPTIONS = [
  { label:"Off",        value:0, sub:"Never used in prompts" },
  { label:"Normal",     value:1, sub:"Default weight" },
  { label:"Emphasized", value:2, sub:"Prioritized over other domains" },
];

function KnowledgeTab({ toast }) {
  const [cfg,         setCfg]         = useState(getKBConfig());
  const [newCategory, setNewCategory] = useState("nutrition");
  const [newTags,     setNewTags]     = useState("");
  const [newFact,     setNewFact]     = useState("");
  const [newWeight,   setNewWeight]   = useState(5);

  function refresh() { setCfg(getKBConfig()); }

  function setMult(catId, mult) { setCategoryMultiplier(catId, mult); refresh(); }

  function handleAdd() {
    if (!newFact.trim()) { toast("Write the fact first", "warning"); return; }
    addCustomFact({ category:newCategory, tags:newTags, fact:newFact, weight:newWeight });
    setNewTags(""); setNewFact(""); setNewWeight(5);
    refresh();
    toast("Custom fact added — the AI will start weighing it in 🧠", "success");
  }

  function handleRemove(id) {
    removeCustomFact(id);
    refresh();
    toast("Removed", "info");
  }

  const curatedCounts = {};
  KNOWLEDGE_BASE.forEach(f => { curatedCounts[f.category] = (curatedCounts[f.category]||0) + 1; });

  return (
    <div className="sform">
      <div className="sform-title">Knowledge Base</div>
      <p className="sform-sub">
        GRIND grounds its answers — meal plans, workout plans, physique reads, stats insights, chat —
        in a curated library of real fitness, nutrition, and body-composition facts instead of letting
        the model freelance from memory. It's a lightweight, fully-local stand-in for a true vector-RAG
        pipeline (no embeddings or vector store needed): every fact is tagged and <strong>weighted</strong>,
        and the highest-scoring ones for each feature get spliced straight into its prompt.
      </p>
      <p className="sform-hint">
        Tune how much each knowledge domain gets leaned on, or add your own facts below — yours compete
        for the same "slots" as the curated ones, a simple but real way to add your own weights to the mix.
        Everything here stays on this device.
      </p>

      <label className="slabel" style={{ marginTop:18 }}>Category weights</label>
      <div className="kb-cat-list">
        {Object.entries(KB_CATEGORIES).map(([id, cat]) => {
          const mult = getCategoryMultiplier(cfg, id);
          const mine = cfg.customFacts.filter(f => f.category===id).length;
          const CatIcon = KB_CAT_ICONS[id];
          return (
            <div key={id} className="kb-cat-row">
              <div className="kb-cat-info">
                <div className="kb-cat-title">
                  {CatIcon && <CatIcon size={14} style={{ verticalAlign:"-2px", marginRight:4 }}/>}{cat.label}
                  <span className="kb-cat-count"> · {curatedCounts[id]||0} curated{mine ? ` + ${mine} yours` : ""}</span>
                </div>
                <div className="kb-cat-desc">{cat.desc}</div>
              </div>
              <div className="seg-ctrl">
                {KB_MULT_OPTIONS.map(opt => (
                  <button key={opt.value} className={`seg-btn ${mult===opt.value?"active":""}`}
                    onClick={() => setMult(id, opt.value)} title={opt.sub}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <label className="slabel" style={{ marginTop:24 }}>Add your own fact</label>
      <p className="sform-hint">
        Anything you want the AI to factor in — your own training philosophy, something your coach or
        doctor told you, a rule you live by. Write it in plain language; the AI translates it into its
        own voice when it actually uses it.
      </p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:8 }}>
        <select className="sinp" style={{ flex:"1 1 170px" }} value={newCategory} onChange={e=>setNewCategory(e.target.value)}>
          {Object.entries(KB_CATEGORIES).map(([id,cat]) => <option key={id} value={id}>{cat.emoji} {cat.label}</option>)}
        </select>
        <input className="sinp" style={{ flex:"2 1 220px" }}
          placeholder="Tags, comma-separated (e.g. recovery, soreness, sleep)"
          value={newTags} onChange={e=>setNewTags(e.target.value)}/>
      </div>
      <textarea className="sinp" style={{ marginTop:10, resize:"vertical", fontFamily:"inherit" }} rows={3}
        placeholder="e.g. My physio said my lower back tightness is from sitting all day, not lifting — daily hip-flexor stretches help more than rest."
        value={newFact} onChange={e=>setNewFact(e.target.value)}/>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:10 }}>
        <span className="slabel" style={{ margin:0, whiteSpace:"nowrap" }}>Weight: {newWeight}/10</span>
        <input type="range" min={1} max={10} value={newWeight} onChange={e=>setNewWeight(+e.target.value)} style={{ flex:1 }}/>
      </div>
      <div className="sbtn-row">
        <button className="sbtn-save" onClick={handleAdd} disabled={!newFact.trim()}>+ Add Fact</button>
      </div>

      {cfg.customFacts.length > 0 && (
        <>
          <label className="slabel" style={{ marginTop:24 }}>Your facts ({cfg.customFacts.length})</label>
          <div className="kb-fact-list">
            {cfg.customFacts.map(f => {
              const FactCatIcon = KB_CAT_ICONS[f.category];
              return (
              <div key={f.id} className="kb-fact-card">
                <div className="kb-fact-meta">
                  <span className="kb-fact-cat">
                    {FactCatIcon && <FactCatIcon size={12} style={{ verticalAlign:"-2px", marginRight:3 }}/>}
                    {KB_CATEGORIES[f.category]?.label}
                  </span>
                  <span className="kb-fact-weight">weight {f.weight}/10</span>
                  <button className="kb-fact-remove" onClick={() => handleRemove(f.id)} title="Remove this fact"><X size={12}/></button>
                </div>
                <div className="kb-fact-text">{f.fact}</div>
                {f.tags?.length > 0 && (
                  <div className="kb-fact-tags">
                    {f.tags.map(t => <span key={t} className="kb-fact-tag">{t}</span>)}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileTab({ user, toast }) {
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    import("../lib/firebase").then(m => m.getUserOnboarding(user.uid)).then(o => {
      setData(o || {});
      setLoad(false);
    });
  }, [user]);

  function update(key, val) { setData(d => ({ ...d, [key]: val })); }
  function toggleMulti(key, val) {
    setData(d => {
      const cur = d[key] || [];
      return { ...d, [key]: cur.includes(val) ? cur.filter(v=>v!==val) : [...cur, val] };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const { saveOnboarding } = await import("../lib/firebase");
      await saveOnboarding(user.uid, data);
      toast("Profile updated — AI will use these now", "success");
    } catch(e) { toast("Save failed","error"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="sform"><div className="spinner"/></div>;

  return (
    <div className="sform">
      <div className="sform-title">Your Profile</div>
      <p className="sform-sub">This info gets fed to the AI so coaching actually fits you. Update anytime.</p>

      <label className="slabel" style={{ marginTop:12 }}>Main goal</label>
      <textarea className="sinp" rows={2} value={data.primaryGoal||""}
        onChange={e=>update("primaryGoal", e.target.value)} style={{ resize:"vertical", fontFamily:"'Syne',sans-serif" }}/>

      <label className="slabel" style={{ marginTop:12 }}>What drives you?</label>
      <textarea className="sinp" rows={2} value={data.motivation||""}
        onChange={e=>update("motivation", e.target.value)} style={{ resize:"vertical", fontFamily:"'Syne',sans-serif" }}/>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
        <div>
          <label className="slabel">Activity level</label>
          <select className="sinp" value={data.activityLevel||""} onChange={e=>update("activityLevel", e.target.value)}>
            <option value="">—</option>
            {["Sedentary (barely move)","Lightly active (walk daily)","Moderately active (exercise 3-4x/wk)","Very active (intense 5+/wk)","Athlete (training daily)"].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="slabel">Workouts / week</label>
          <input className="sinp" type="number" min={0} max={14} value={data.exerciseFreq||""}
            onChange={e=>update("exerciseFreq", e.target.value)}/>
        </div>
      </div>

      <label className="slabel" style={{ marginTop:12 }}>Sport / main activity</label>
      <input className="sinp" value={data.sport||""} onChange={e=>update("sport", e.target.value)}/>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
        <div>
          <label className="slabel">Weight</label>
          <input className="sinp" type="number" value={data.weight||""} onChange={e=>update("weight", e.target.value)}/>
        </div>
        <div>
          <label className="slabel">Unit</label>
          <select className="sinp" value={data.weightUnit||"lbs"} onChange={e=>update("weightUnit", e.target.value)}>
            <option>lbs</option><option>kg</option>
          </select>
        </div>
      </div>

      <label className="slabel" style={{ marginTop:12 }}>Confidence (1-10)</label>
      <input type="range" min={1} max={10} value={data.confidence||5}
        onChange={e=>update("confidence", +e.target.value)} className="onboard-slider"/>
      <div style={{ textAlign:"right", color:"var(--accent)", fontFamily:"'Bebas Neue',sans-serif", fontSize:18 }}>{data.confidence||5}</div>

      <label className="slabel" style={{ marginTop:12 }}>Stress (1-10)</label>
      <input type="range" min={1} max={10} value={data.stressLevel||5}
        onChange={e=>update("stressLevel", +e.target.value)} className="onboard-slider"/>
      <div style={{ textAlign:"right", color:"var(--accent)", fontFamily:"'Bebas Neue',sans-serif", fontSize:18 }}>{data.stressLevel||5}</div>

      <label className="slabel" style={{ marginTop:12 }}>Diet</label>
      <select className="sinp" value={data.diet||""} onChange={e=>update("diet", e.target.value)}>
        <option value="">—</option>
        {["No restrictions","Vegetarian","Vegan","Pescatarian","Keto/Low-carb","Halal","Kosher","Other"].map(o=><option key={o}>{o}</option>)}
      </select>

      <label className="slabel" style={{ marginTop:12 }}>Dietary restrictions / allergies</label>
      <input className="sinp" value={data.dietaryRestrictions||""} onChange={e=>update("dietaryRestrictions", e.target.value)}/>

      <label className="slabel" style={{ marginTop:12 }}>Currently struggling with</label>
      <div className="onboard-chips">
        {["Procrastination","Social anxiety","Phone addiction","Doom scrolling","Junk food","Inconsistent sleep","Low motivation","Comparison/jealousy","Not enough time","Overthinking","Self-doubt","Distractions during work"].map(opt => {
          const active = (data.struggles||[]).includes(opt);
          return <button key={opt} type="button" className={`onboard-chip ${active?"active":""}`}
            onClick={()=>toggleMulti("struggles", opt)}>{active && "✓ "}{opt}</button>;
        })}
      </div>

      <div className="sdivider"/>
      <label className="slabel">Additional info for the AI</label>
      <p className="sform-sub" style={{ marginBottom:6 }}>Anything else the coach should know. Super useful for personalization.</p>
      <textarea className="sinp" rows={4} value={data.additionalInfo||""}
        onChange={e=>update("additionalInfo", e.target.value)}
        placeholder="e.g. I throw shot put for Mason High School, finals in 3 weeks, I drink way too much coffee..."
        style={{ resize:"vertical", fontFamily:"'Syne',sans-serif" }}/>

      <button className="btn-primary" onClick={save} disabled={saving} style={{ width:"auto", padding:"10px 32px", marginTop:20 }}>
        {saving ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
}

function HealthReminders({ toast }) {
  const [list, setList]       = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    import("../lib/reminders").then(m => {
      setList(m.getRemindersList());
      setSettings(m.getReminderSettings());
    });
  }, []);

  async function toggle(id, enabled) {
    const m = await import("../lib/reminders");
    if (enabled) {
      const ok = await m.ensurePermission();
      if (!ok) { toast("Allow notifications to use background reminders","warning"); }
    }
    m.setReminderSetting(id, { enabled });
    setSettings(m.getReminderSettings());
    if (enabled) toast("Reminder turned on ✅", "success", 2000);
  }

  async function setInterval(id, interval) {
    const m = await import("../lib/reminders");
    m.setReminderSetting(id, { interval: +interval });
    setSettings(m.getReminderSettings());
  }

  if (!list.length) return null;
  return (
    <div className="reminder-list">
      {list.map(r => {
        const cfg = settings[r.id] || { enabled: false, interval: r.defaultMin };
        return (
          <div key={r.id} className="reminder-row">
            <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
              {(() => { const RIcon = REMINDER_ICONS[r.id]; return RIcon ? <RIcon size={18} style={{ flexShrink:0 }}/> : null; })()}
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{r.label}</div>
                <div style={{ fontSize:12, color:"#888" }}>{r.msg}</div>
              </div>
            </div>
            {cfg.enabled && (
              <select className="sinp" value={cfg.interval}
                onChange={e => setInterval(r.id, e.target.value)} style={{ width:120, marginRight:10 }}>
                {[15,20,30,45,60,90,120,180].map(m => <option key={m} value={m}>every {m}m</option>)}
              </select>
            )}
            <div className={`toggle-switch ${cfg.enabled?"on":""}`} onClick={() => toggle(r.id, !cfg.enabled)} style={{ cursor:"pointer" }}>
              <div className="toggle-thumb"/>
            </div>
          </div>
        );
      })}
    </div>
  );
}
