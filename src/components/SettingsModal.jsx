import { useState, useEffect } from "react";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/userSettings";
import { PROVIDERS, getAIConfig, saveAIConfig, clearAIConfig, testKey } from "../lib/aiProvider";
import { HABIT_CATEGORIES } from "../data/gameData";
import { useAuth } from "../hooks/useAuth";
import { logout, updateUserProfile, getCheckinHistory, uploadProfilePhoto, enablePushNotifications, updateReminderPrefs } from "../lib/firebase";
import { useToast } from "./Toast";

const TABS = [
  { id:"ai",       icon:"🤖", label:"AI Provider"    },
  { id:"profile",  icon:"🧬", label:"Your Profile"   },
  { id:"appear",   icon:"🎨", label:"Appearance"     },
  { id:"habits",   icon:"✅", label:"Habits"         },
  { id:"game",     icon:"🎮", label:"Gamification"   },
  { id:"notifs",   icon:"🔔", label:"Notifications"  },
  { id:"data",     icon:"💾", label:"Data"           },
  { id:"account",  icon:"👤", label:"Account"        },
];

const ACCENT_PRESETS = [
  { label:"Gold",    value:"#FFD700" },
  { label:"Red",     value:"#FF4D4D" },
  { label:"Blue",    value:"#4DC9FF" },
  { label:"Green",   value:"#00FF88" },
  { label:"Purple",  value:"#B84DFF" },
  { label:"Orange",  value:"#FF9800" },
  { label:"Pink",    value:"#FF69B4" },
  { label:"White",   value:"#E8E8E8" },
];

export default function SettingsModal({ onClose, onResetKey }) {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("ai");
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

  // Habits tab state
  const [newHabit, setNewHabit] = useState({ label:"", categoryId:"fitness", xp:10 });
  const [customHabits, setCustomHabits] = useState(settings.customHabits || []);

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
  function switchProvider(p) {
    setAiProvider(p); setAiModel(PROVIDERS[p].defaultModel);
    setAiKey(""); setVerified(false); setKeyError("");
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
    toast(`${PROVIDERS[aiProvider].name} saved ✅`, "success");
  }

  function clearAI() {
    clearAIConfig();
    setAiKey(""); setVerified(false); setKeyError("");
    toast("API key cleared", "warning");
    onResetKey?.();
  }

  // ── Habits tab ──────────────────────────────────────────────────────────
  function toggleCategory(catId) {
    const current = settings.enabledCategories || Object.keys(HABIT_CATEGORIES);
    const next = current.includes(catId)
      ? current.filter(c => c !== catId)
      : [...current, catId];
    if (next.length === 0) { toast("Need at least one category enabled", "warning"); return; }
    update("enabledCategories", next);
  }

  function addCustomHabit() {
    if (!newHabit.label.trim()) { toast("Enter a habit name", "warning"); return; }
    const habit = { ...newHabit, id:`custom_${Date.now()}`, label:newHabit.label.trim() };
    const next = [...customHabits, habit];
    setCustomHabits(next);
    update("customHabits", next);
    setNewHabit({ label:"", categoryId:"fitness", xp:10 });
    toast("Custom habit added ✅", "success");
  }

  function removeCustomHabit(id) {
    const next = customHabits.filter(h => h.id !== id);
    setCustomHabits(next);
    update("customHabits", next);
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
        customHabits,
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
  const enabled  = settings.enabledCategories || Object.keys(HABIT_CATEGORIES);

  return (
    <div className="settings-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">⚙️ Settings</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* Sidebar tabs */}
          <div className="settings-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`settings-tab ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>
                <span className="stab-icon">{t.icon}</span>
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
                    <span style={{ color:PROVIDERS[activeAI.provider]?.color }}>{PROVIDERS[activeAI.provider]?.icon} {PROVIDERS[activeAI.provider]?.name}</span>
                    <span className="active-badge-model">{activeAI.model}</span>
                    <span className="live-dot"/>
                  </div>
                )}

                <div className="provider-grid">
                  {Object.entries(PROVIDERS).map(([id,p]) => (
                    <button key={id} className={`prov-btn ${aiProvider===id?"active":""}`}
                      style={{ "--pc":p.color }} onClick={() => switchProvider(id)}>
                      <span style={{ fontSize:24 }}>{p.icon}</span>
                      <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
                      {activeAI?.provider===id && <span className="prov-live"/>}
                    </button>
                  ))}
                </div>

                <div className="srow">
                  <label className="slabel">Model</label>
                  <a href={prov.url} target="_blank" rel="noopener noreferrer" className="slink">Get free key →</a>
                </div>
                <select className="sinp" value={aiModel} onChange={e=>{setAiModel(e.target.value);setVerified(false);}}>
                  {prov.models.map(m=><option key={m}>{m}</option>)}
                </select>

                <label className="slabel" style={{ marginTop:14 }}>API Key</label>
                <div className="key-wrap">
                  <input className="sinp key-field" type={showKey?"text":"password"}
                    placeholder={prov.placeholder} value={aiKey}
                    onChange={e=>{setAiKey(e.target.value);setVerified(false);setKeyError("");}}
                    onPaste={e=>{e.preventDefault();setAiKey(e.clipboardData.getData("text").trim());setVerified(false);setKeyError("");}}/>
                  <button className="key-vis" onClick={()=>setShowKey(s=>!s)}>{showKey?"🙈":"👁️"}</button>
                </div>
                {keyError && <div className="serr">{keyError}</div>}
                {verified && <div className="sok">✅ Key verified and working</div>}

                <div className="sprov-note">
                  {aiProvider==="anthropic"  && "Best quality for all features incl. vision. Paid only — check console.anthropic.com for credits."}
                  {aiProvider==="gemini"     && "Free tier: 15 req/min. Gemini Flash recommended. Vision fully supported."}
                  {aiProvider==="groq"       && "Blazing fast, very generous free tier. Vision limited to certain models only."}
                  {aiProvider==="openrouter" && "100+ models behind one key. Many free options. Vision depends on chosen model."}
                </div>

                <div className="sbtn-row">
                  <button className="sbtn-test" onClick={handleTestKey} disabled={testing||!aiKey.trim()}>
                    {testing?"Testing…":"Test Key"}
                  </button>
                  <button className="sbtn-save" onClick={saveAI} disabled={!aiKey.trim()}>Save</button>
                  {activeAI && <button className="sbtn-danger" onClick={clearAI}>Clear</button>}
                </div>
              </div>
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

                <label className="slabel">Accent Color</label>
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
                    🎨
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
                <p className="sform-sub">Enable/disable categories and add your own custom habits.</p>

                <label className="slabel">Active Categories</label>
                <div className="cat-toggles">
                  {Object.entries(HABIT_CATEGORIES).map(([id, cat]) => (
                    <button key={id}
                      className={`cat-toggle-btn ${enabled.includes(id)?"active":""}`}
                      style={{ "--cc":cat.color }}
                      onClick={() => toggleCategory(id)}>
                      <span style={{ fontSize:20 }}>{cat.icon}</span>
                      <span style={{ fontWeight:700, fontSize:13 }}>{cat.label}</span>
                      <span className="cat-toggle-check">{enabled.includes(id)?"✓":""}</span>
                    </button>
                  ))}
                </div>

                <div className="sdivider"/>

                <div className="sform-title" style={{ fontSize:14 }}>Custom Habits</div>
                <div className="custom-habit-form">
                  <input className="sinp" placeholder="Habit name (e.g. Practice guitar)"
                    value={newHabit.label} onChange={e=>setNewHabit(h=>({...h,label:e.target.value}))}
                    onKeyDown={e=>e.key==="Enter"&&addCustomHabit()}/>
                  <select className="sinp" value={newHabit.categoryId}
                    onChange={e=>setNewHabit(h=>({...h,categoryId:e.target.value}))}>
                    {Object.entries(HABIT_CATEGORIES).map(([id,cat])=>(
                      <option key={id} value={id}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <label className="slabel" style={{ margin:0, whiteSpace:"nowrap" }}>XP</label>
                    <input className="sinp" type="number" min={1} max={50} value={newHabit.xp}
                      onChange={e=>setNewHabit(h=>({...h,xp:+e.target.value}))} style={{ width:80 }}/>
                    <button className="sbtn-save" onClick={addCustomHabit}>Add</button>
                  </div>
                </div>

                {customHabits.length > 0 && (
                  <div className="custom-habits-list">
                    {customHabits.map(h => {
                      const cat = HABIT_CATEGORIES[h.categoryId];
                      return (
                        <div key={h.id} className="custom-habit-row">
                          <span style={{ color:cat?.color, fontSize:16 }}>{cat?.icon}</span>
                          <span style={{ flex:1, fontSize:14 }}>{h.label}</span>
                          <span style={{ color:"#FFD700", fontFamily:"monospace", fontSize:12 }}>+{h.xp} XP</span>
                          <button className="habit-remove" onClick={()=>removeCustomHabit(h.id)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <span>⚠️</span>
                  <span>Browser notifications require you to grant permission. GRIND will request this the first time a reminder fires. Mobile PWA install required for background reminders.</span>
                </div>

                <div className="sdivider"/>
                <div className="sform-title" style={{ fontSize:14 }}>💧 Health Reminders</div>
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
                  <div className="data-card-icon">📦</div>
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
                  <div className="data-card-icon">🗑️</div>
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
                      {uploadingPhoto ? "⏳" : "📷"}
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
                    ["⚡ XP",     profile?.xp||0],
                    ["🔥 Streak", profile?.streak||0],
                    ["🏅 Level",  profile?.level||1],
                    ["✅ Check-ins", profile?.longestStreak||0],
                  ].map(([k,v])=>(
                    <div key={k} className="stats-mini-item">
                      <div className="smi-val">{v}</div>
                      <div className="smi-key">{k}</div>
                    </div>
                  ))}
                </div>

                <div className="sdivider"/>

                <div className="sform-title" style={{ fontSize:14 }}>Connected Services</div>
                <div className="service-row">
                  <span>🔥 Firebase Auth</span>
                  <span className="service-status active">Connected</span>
                </div>
                <div className="service-row">
                  <span>🤖 AI Provider</span>
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
      <div style={{ textAlign:"right", color:"#FFD700", fontFamily:"'Bebas Neue',sans-serif", fontSize:18 }}>{data.confidence||5}</div>

      <label className="slabel" style={{ marginTop:12 }}>Stress (1-10)</label>
      <input type="range" min={1} max={10} value={data.stressLevel||5}
        onChange={e=>update("stressLevel", +e.target.value)} className="onboard-slider"/>
      <div style={{ textAlign:"right", color:"#FFD700", fontFamily:"'Bebas Neue',sans-serif", fontSize:18 }}>{data.stressLevel||5}</div>

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
              <span style={{ fontSize:20 }}>{r.icon}</span>
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
