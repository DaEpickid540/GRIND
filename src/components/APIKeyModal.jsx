// Forced modal shown until user has a valid API key configured
import { useState } from "react";
import { Zap, Eye, EyeOff, CheckSquare, BookOpen, Lock } from "lucide-react";
import { PROVIDERS, saveAIConfig, testKey, getAIConfig } from "../lib/aiProvider";
import { useToast } from "./Toast";

export default function APIKeyModal({ onDone, onShowTutorial }) {
  const toast = useToast();
  const existing = getAIConfig();

  const [provider,  setProvider]  = useState(existing?.provider || "anthropic");
  const [key,       setKey]       = useState(existing?.key || "");
  const [model,     setModel]     = useState(existing?.model || PROVIDERS["anthropic"].defaultModel);
  const [testing,   setTesting]   = useState(false);
  const [verified,  setVerified]  = useState(false);
  const [showKey,   setShowKey]   = useState(false);
  const [error,     setError]     = useState("");

  const prov = PROVIDERS[provider];

  function switchProvider(p) {
    setProvider(p);
    setModel(PROVIDERS[p].defaultModel);
    setKey("");
    setVerified(false);
    setError("");
  }

  async function handleTest() {
    if (!key.trim()) { setError("Paste your API key first."); return; }
    setTesting(true); setError(""); setVerified(false);
    try {
      await testKey(provider, key.trim(), model);
      setVerified(true);
      toast("Key verified! ✅", "success");
    } catch(e) {
      setError(`Key failed: ${e.message}. Double-check the key and selected model.`);
      toast("Key verification failed", "error");
    } finally { setTesting(false); }
  }

  function handleSave() {
    if (!key.trim()) { setError("Paste your API key first."); return; }
    saveAIConfig({ provider, key:key.trim(), model });
    toast(`${prov.name} configured ✅`, "success");
    onDone();
  }

  return (
    <div className="apikey-overlay">
      <div className="apikey-modal">
        {/* Header */}
        <div className="apikey-header">
          <div className="apikey-logo" style={{ display:"flex", justifyContent:"center" }}><Zap size={32} color="var(--accent)"/></div>
          <h2 className="apikey-title">Connect Your AI</h2>
          <p className="apikey-sub">
            GRIND uses AI for weekly plans, nutrition scanning, and body analysis.<br/>
            Your key is stored <strong>only on this device</strong> — never sent to any server.
          </p>
        </div>

        {/* Provider tabs */}
        <div className="apikey-providers">
          {Object.entries(PROVIDERS).map(([id, p]) => (
            <button key={id}
              className={`provider-tab ${provider===id?"active":""}`}
              style={{ "--pcolor": p.color }}
              onClick={() => switchProvider(id)}>
              <span className="provider-icon prov-logo-chip"><img src={p.icon} alt=""/></span>
              <span className="provider-name">{p.name}</span>
              {provider===id && <span className="provider-dot"/>}
            </button>
          ))}
        </div>

        {/* Provider details */}
        <div className="apikey-body">
          <div className="provider-info">
            <span style={{ display:"inline-flex", alignItems:"center", gap:8, color: prov.color, fontWeight:700 }}>
              <img src={prov.icon} alt="" className="prov-logo-sm"/> {prov.name}
            </span>
            <a href={prov.url} target="_blank" rel="noopener noreferrer" className="get-key-link">
              Get a free key →
            </a>
          </div>

          {/* Model selector */}
          <div className="field-group">
            <label className="field-label">Model</label>
            <select className="inp apikey-select" value={model} onChange={e => { setModel(e.target.value); setVerified(false); }}>
              {prov.models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Key input */}
          <div className="field-group">
            <label className="field-label">API Key</label>
            <div className="key-input-wrap">
              <input
                className="inp key-inp"
                type={showKey ? "text" : "password"}
                placeholder={prov.placeholder}
                value={key}
                onChange={e => { setKey(e.target.value); setVerified(false); setError(""); }}
                onPaste={e => {
                  // Auto-strip whitespace on paste
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").trim();
                  setKey(pasted); setVerified(false); setError("");
                }}
              />
              <button className="key-eye" onClick={() => setShowKey(s => !s)} title={showKey?"Hide":"Show"}>
                {showKey ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {error && <div className="key-error">{error}</div>}
            {verified && <div className="key-ok" style={{ display:"flex", alignItems:"center", gap:5 }}><CheckSquare size={13}/> Key verified and working</div>}
          </div>

          {/* Provider notes */}
          <div className="provider-note">
            {provider==="anthropic"  && "Best quality. Claude Sonnet is recommended. ~$3/1M tokens."}
            {provider==="gemini"     && "Free tier available. Gemini Flash is fast and free up to 15 req/min."}
            {provider==="groq"       && "Extremely fast. Free tier is very generous. Vision features limited."}
            {provider==="openrouter" && "Access 100+ models with one key. Pay-per-use, many free options."}
          </div>
        </div>

        {/* Actions */}
        <div className="apikey-footer">
          <button className="btn-test" onClick={handleTest} disabled={testing || !key.trim()}>
            {testing ? "Testing…" : "Test Key"}
          </button>
          <button className="btn-primary apikey-save" onClick={handleSave} disabled={!key.trim()}
            style={{ opacity: key.trim() ? 1 : .4, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            {verified ? <><CheckSquare size={14}/> Save & Continue</> : "Skip Test & Save"}
          </button>
        </div>

        {onShowTutorial && (
          <div style={{ textAlign:"center", padding:"0 32px 12px" }}>
            <button onClick={onShowTutorial} className="apikey-tutorial-link" style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
              <BookOpen size={13}/> New here? See the Setup Guide instead →
            </button>
          </div>
        )}

        <p className="apikey-disclaimer" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
          <Lock size={11}/> Keys are saved to your browser's localStorage and never leave your device.
        </p>
      </div>
    </div>
  );
}
