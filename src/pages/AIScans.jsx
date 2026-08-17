import { useState, useRef, useEffect } from "react";
import { Camera, Eye, Shirt, Dumbbell, PersonStanding, Search, CheckCircle2, Wrench, Target, Lightbulb, AlertTriangle } from "lucide-react";
import { callAI, getAIConfig, getModelInfo, currentModelSupportsVision, PROVIDERS } from "../lib/aiProvider";
import { useToast } from "../components/Toast";
import { useAuth } from "../hooks/useAuth";
import { saveScanResult, getScanHistory } from "../lib/firebase";
import { buildSystemPrompt } from "../lib/coachVoice";

// All AI Scans require image upload — warn if the selected model can't see images
function VisionOnlyBanner() {
  const cfg = getAIConfig();
  if (!cfg?.provider) return null;
  const actualModel = cfg.model || PROVIDERS[cfg.provider]?.defaultModel;
  if (!actualModel) return null;
  const info = getModelInfo(actualModel);
  if (info.vision !== false) return null;
  return (
    <div className="vision-only-banner">
      <span className="vision-only-icon"><Eye size={22}/></span>
      <div>
        <strong>Visual model required — all AI Scans need photo analysis</strong>
        <span style={{ display:"block", fontSize:12, color:"#FF9800", marginTop:2 }}>
          "{info.label}" is a text-only model and cannot analyze images. Go to{" "}
          <strong>Settings → AI</strong> and switch to a vision-capable model
          (e.g. Gemini Flash, GPT-4o, Claude Sonnet, Qwen3.6 27B).
        </span>
      </div>
    </div>
  );
}

function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

const SCAN_TYPES = [
  { id:"outfit",   feature:"outfit",   label:"Outfit Rating",    icon:Shirt,          desc:"AI rates your style, fit, and color coordination" },
  { id:"physique", feature:"physique", label:"Physique Scan",    icon:Dumbbell,       desc:"Body composition analysis and training tips" },
  { id:"posture",  feature:"posture",  label:"Posture Analysis", icon:PersonStanding, desc:"Detect posture issues and get correction tips" },
];

export default function AIScans() {
  const toast = useToast();
  const { user } = useAuth();
  const [active,   setActive]   = useState(SCAN_TYPES[0]);
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const [history,  setHistory]  = useState([]);
  const fileRef = useRef();

  // Load scan history for the active scan type
  useEffect(() => {
    if (!user) return;
    getScanHistory(user.uid, active.id).then(setHistory);
  }, [user, active]);

  const visionReady = currentModelSupportsVision();

  function switchScan(s) { setActive(s); setResult(null); setImage(null); setPreview(null); }

  function handleFile(e) {
    if (!visionReady) { toast("Your AI model can't see images — pick a vision model in Settings ⚙️", "error"); return; }
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast("Image too large (max 8MB)", "warning"); return; }
    const reader = new FileReader();
    reader.onload = ev => { setPreview(ev.target.result); setImage(file); setResult(null); };
    reader.readAsDataURL(file);
  }

  async function scan() {
    if (!image||scanning) return;
    setScanning(true);
    try {
      const b64  = preview.split(",")[1];
      const system = await buildSystemPrompt(active.feature, user?.uid, null);
      const text = await callAI({ system, userMessage:`Run a ${active.label}.`, imageBase64:b64, imageMime:image.type||"image/jpeg", maxTokens:800 });
      const parsed = parseAIJson(text);
      setResult(parsed);
      if (user) {
        await saveScanResult(user.uid, active.id, parsed);
        const updated = await getScanHistory(user.uid, active.id);
        setHistory(updated);
      }
      toast(`${active.label} complete!`, "success");
    } catch(e) {
      if (e.message==="NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else if (e.message==="NO_VISION") toast("Your AI model can't see images — pick a vision model in Settings ⚙️", "error");
      else toast("Scan failed", "error");
      console.error(e);
    } finally { setScanning(false); }
  }

  function renderResult(r) {
    if (!r) return null;
    if (active.id==="outfit") return (
      <div className="scan-result">
        <div className="scan-score" style={{ color:"var(--accent)" }}>{r.score}<span style={{ fontSize:18 }}>/100</span></div>
        <div className="scan-category">{r.styleCategory}</div>
        <p style={{ color:"#ccc",margin:"8px 0" }}>{r.overall}</p>
        <div className="scan-lists">
          <div><h4 style={{ color:"#00FF88", display:"flex", alignItems:"center", gap:6 }}><CheckCircle2 size={15}/> Strengths</h4>{r.strengths?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
          <div><h4 style={{ color:"#FF4D4D", display:"flex", alignItems:"center", gap:6 }}><Wrench size={15}/> Improve</h4>{r.improvements?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
        </div>
        {r.tip && <div className="scan-tip" style={{ display:"flex", alignItems:"flex-start", gap:8 }}><Lightbulb size={15} style={{ flexShrink:0, marginTop:2 }}/> {r.tip}</div>}
      </div>
    );
    if (active.id==="physique") return (
      <div className="scan-result">
        <div style={{ display:"flex",gap:20,marginBottom:16,flexWrap:"wrap" }}>
          <div className="stat-chip"><span style={{ color:"#FF9800" }}>{r.bodyFatEstimate}</span><span> Est. Body Fat</span></div>
          <div className="stat-chip"><span style={{ color:"#4DC9FF" }}>{r.posture}</span><span> Posture</span></div>
        </div>
        <div className="scan-lists">
          <div><h4 style={{ color:"#00FF88", display:"flex", alignItems:"center", gap:6 }}><Dumbbell size={15}/> Strong</h4>{r.muscleGroups?.strong?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
          <div><h4 style={{ color:"#FF4D4D", display:"flex", alignItems:"center", gap:6 }}><Target size={15}/> Need Work</h4>{r.muscleGroups?.needWork?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
        </div>
        <h4 style={{ color:"var(--accent)",marginTop:12 }}>Training Tips</h4>
        {r.trainingTips?.map((t,i)=><div key={i} className="scan-item">→ {t}</div>)}
        {r.overallAssessment && <div className="scan-tip">{r.overallAssessment}</div>}
      </div>
    );
    if (active.id==="posture") return (
      <div className="scan-result">
        <div className="scan-score" style={{ color:r.score>=80?"#00FF88":r.score>=60?"#D4A017":"#FF4D4D" }}>{r.score}<span style={{ fontSize:18 }}>/100</span></div>
        <p style={{ color:"#ccc",margin:"8px 0" }}>{r.summary}</p>
        <div className="scan-lists">
          <div><h4 style={{ color:"#FF4D4D", display:"flex", alignItems:"center", gap:6 }}><AlertTriangle size={15}/> Issues</h4>{r.issues?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
          <div><h4 style={{ color:"#00FF88", display:"flex", alignItems:"center", gap:6 }}><CheckCircle2 size={15}/> Fix It</h4>{r.corrections?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
        </div>
        <h4 style={{ color:"#4DC9FF",marginTop:12 }}>Daily Exercises</h4>
        {r.dailyExercises?.map((e,i)=><div key={i} className="scan-item">→ {e}</div>)}
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header"><div><h1 className="page-title" style={{ display:"inline-flex", alignItems:"center", gap:10 }}><Camera size={32}/> AI Scans</h1><p className="page-sub">Upload a photo for instant AI analysis</p></div></div>
      <VisionOnlyBanner />
      <div className="scan-tabs">
        {SCAN_TYPES.map(s => <button key={s.id} className={`scan-tab ${active.id===s.id?"active":""}`} onClick={()=>switchScan(s)}><s.icon size={20}/><span>{s.label}</span></button>)}
      </div>
      <p style={{ color:"#666",fontSize:13,marginBottom:20 }}>{active.desc}</p>
      <div className="scan-layout">
        <div className="scan-upload">
          <div className={`upload-zone${!visionReady ? " upload-zone-locked" : ""}`}
            onClick={()=>visionReady && fileRef.current.click()}
            title={!visionReady ? "Switch to a vision model in Settings to upload a photo" : undefined}
            style={{ height:300 }}>
            {preview ? <img src={preview} alt="" style={{ width:"100%",height:"100%",objectFit:"contain",borderRadius:10 }}/>
              : !visionReady ? <><Eye size={56} style={{ opacity:.4 }}/><p>Vision model required — switch in Settings</p></>
              : <><active.icon size={56}/><p>Click to upload photo</p></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} disabled={!visionReady}/>
          <button className="btn-primary" onClick={scan} disabled={!image||scanning||!visionReady} style={{ marginTop:12, display:"inline-flex", alignItems:"center", gap:8, justifyContent:"center" }}
            title={!visionReady ? "Your selected AI model can't see images — switch to a vision model in Settings" : undefined}>
            {scanning ? <><Search size={16}/> Analyzing…</> : `Run ${active.label}`}
          </button>
        </div>
        <div className="scan-results">
          {!result&&!scanning && <div className="empty-state-card"><p style={{ color:"#555" }}>Upload a photo and hit scan to see results.</p></div>}
          {scanning && <div className="loading-card"><div className="spinner"/><p>Analyzing…</p></div>}
          {result && renderResult(result)}

          {history.length > 0 && (
            <div className="scan-history">
              <h4 style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:.5, margin:"20px 0 10px" }}>
                Past {active.label}{active.label.endsWith("s") ? "" : "s"} ({history.length})
              </h4>
              <div className="scan-history-list">
                {history.map(h => {
                  const r = h.result || {};
                  const score = r.score ?? r.bodyFatEstimate ?? "✓";
                  const when = h.timestamp?.toDate ? h.timestamp.toDate().toLocaleDateString() : "recent";
                  return (
                    <button key={h.id} className="scan-history-item" onClick={() => setResult(r)}>
                      <span className="shi-score">{typeof score==="number"?`${score}`:score}</span>
                      <span className="shi-date">{when}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
