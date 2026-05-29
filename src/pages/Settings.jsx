import { useState } from "react";
import { PROVIDERS, getAIConfig, saveAIConfig, clearAIConfig, testKey } from "../lib/aiProvider";
import { useToast } from "../components/Toast";
import { useAuth } from "../hooks/useAuth";
import { logout } from "../lib/firebase";

export default function Settings({ onResetKey }) {
  const toast   = useToast();
  const { user, profile } = useAuth();
  const existing = getAIConfig();

  const [provider, setProvider] = useState(existing?.provider || "anthropic");
  const [key,      setKey]      = useState(existing?.key || "");
  const [model,    setModel]    = useState(existing?.model || PROVIDERS[existing?.provider||"anthropic"].defaultModel);
  const [testing,  setTesting]  = useState(false);
  const [verified, setVerified] = useState(false);
  const [showKey,  setShowKey]  = useState(false);
  const [error,    setError]    = useState("");

  const prov = PROVIDERS[provider];
  const active = getAIConfig();

  function switchProvider(p) {
    setProvider(p);
    setModel(PROVIDERS[p].defaultModel);
    setKey("");
    setVerified(false);
    setError("");
  }

  async function handleTest() {
    if (!key.trim()) { setError("Enter a key first."); return; }
    setTesting(true); setError(""); setVerified(false);
    try {
      await testKey(provider, key.trim(), model);
      setVerified(true);
      toast("Key works! ✅", "success");
    } catch(e) {
      setError(`Failed: ${e.message}`);
      toast("Key test failed", "error");
    } finally { setTesting(false); }
  }

  function handleSave() {
    if (!key.trim()) { setError("Enter a key first."); return; }
    saveAIConfig({ provider, key:key.trim(), model });
    toast(`${prov.name} saved ✅`, "success");
    setVerified(false);
  }

  function handleClear() {
    clearAIConfig();
    setKey(""); setVerified(false); setError("");
    toast("API key cleared", "warning");
    onResetKey?.();
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">⚙️ Settings</h1><p className="page-sub">Manage your AI provider and account</p></div>
      </div>

      {/* Active config banner */}
      {active && (
        <div className="active-config-banner">
          <span style={{ color: PROVIDERS[active.provider]?.color }}>{PROVIDERS[active.provider]?.icon} {PROVIDERS[active.provider]?.name}</span>
          <span style={{ color:"#888", margin:"0 8px" }}>·</span>
          <span style={{ fontFamily:"monospace", fontSize:13, color:"#888" }}>{active.model}</span>
          <span style={{ marginLeft:"auto", color:"#00FF88", fontSize:12 }}>● Active</span>
        </div>
      )}

      {/* Provider selector */}
      <div className="section-card">
        <h3 className="section-title">AI Provider</h3>
        <div className="settings-providers">
          {Object.entries(PROVIDERS).map(([id, p]) => (
            <button key={id}
              className={`settings-provider-btn ${provider===id?"active":""}`}
              style={{ "--pcolor": p.color }}
              onClick={() => switchProvider(id)}>
              <span style={{ fontSize:22 }}>{p.icon}</span>
              <span style={{ fontWeight:700, fontSize:14 }}>{p.name}</span>
              {active?.provider===id && <span className="active-dot"/>}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"16px 0 8px" }}>
          <label className="field-label">Model</label>
          <a href={prov.url} target="_blank" rel="noopener noreferrer" className="get-key-link">
            Get a free {prov.name} key →
          </a>
        </div>
        <select className="inp" value={model} onChange={e => { setModel(e.target.value); setVerified(false); }}
          style={{ marginBottom:12 }}>
          {prov.models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="field-label" style={{ display:"block", marginBottom:6 }}>API Key</label>
        <div className="key-input-wrap" style={{ marginBottom:8 }}>
          <input className="inp key-inp" type={showKey?"text":"password"}
            placeholder={prov.placeholder} value={key}
            onChange={e => { setKey(e.target.value); setVerified(false); setError(""); }}
            onPaste={e => { e.preventDefault(); setKey(e.clipboardData.getData("text").trim()); setVerified(false); setError(""); }}/>
          <button className="key-eye" onClick={() => setShowKey(s=>!s)}>{showKey?"🙈":"👁️"}</button>
        </div>

        {error   && <div className="key-error" style={{ marginBottom:8 }}>{error}</div>}
        {verified && <div className="key-ok"   style={{ marginBottom:8 }}>✅ Key verified</div>}

        <div className="provider-note" style={{ marginBottom:16 }}>
          {provider==="anthropic"  && "Best quality for all features. Claude Sonnet recommended. Paid only."}
          {provider==="gemini"     && "Free tier: 15 req/min. Gemini Flash is fast and free. Vision supported."}
          {provider==="groq"       && "Ultra-fast inference. Very generous free tier. Vision limited to some models."}
          {provider==="openrouter" && "100+ models. Many free options. Great for trying different models."}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn-test" onClick={handleTest} disabled={testing||!key.trim()}>
            {testing ? "Testing…" : "Test Key"}
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={!key.trim()}
            style={{ width:"auto", padding:"10px 28px", opacity:key.trim()?1:.4 }}>
            Save
          </button>
          {active && (
            <button className="btn-danger" onClick={handleClear}>Clear Key</button>
          )}
        </div>
      </div>

      {/* Account section */}
      <div className="section-card">
        <h3 className="section-title">Account</h3>
        <div className="account-row">
          {user?.photoURL && <img src={user.photoURL} className="sidebar-avatar" referrerPolicy="no-referrer" alt=""/>}
          <div>
            <div style={{ fontWeight:700 }}>{user?.displayName}</div>
            <div style={{ fontSize:13, color:"#888" }}>{user?.email}</div>
          </div>
          <button className="btn-secondary" onClick={logout} style={{ marginLeft:"auto" }}>Sign Out</button>
        </div>
      </div>

      {/* Data section */}
      <div className="section-card">
        <h3 className="section-title">Privacy</h3>
        <p style={{ color:"#888", fontSize:14, marginBottom:12 }}>
          Your API key is stored only in your browser's localStorage. It never touches any server — not Firebase, not ours, not anyone's. The AI calls go directly from your browser to the provider's API.
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {Object.entries(PROVIDERS).map(([id,p]) => (
            <a key={id} href={p.url} target="_blank" rel="noopener noreferrer" className="privacy-link" style={{ borderColor:p.color, color:p.color }}>
              {p.icon} {p.name} Console
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
