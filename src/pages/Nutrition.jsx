import { useState, useRef, useEffect } from "react";
import { callAI } from "../lib/aiProvider";
import { useToast } from "../components/Toast";
import { useAuth } from "../hooks/useAuth";
import { saveNutritionEntry, getNutritionLog } from "../lib/firebase";
import { buildSystemPrompt } from "../lib/coachVoice";

function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

export default function Nutrition() {
  const toast = useToast();
  const { user } = useAuth();
  const [image,   setImage]   = useState(null);
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [scanning,setScanning]= useState(false);
  const [log,     setLog]     = useState([]);
  const fileRef = useRef();

  const today = new Date().toISOString().split("T")[0];

  // Load today's persisted nutrition log
  useEffect(() => {
    if (!user) return;
    getNutritionLog(user.uid, today).then(entries => {
      setLog(entries.map(e => ({ ...e, time: e.time || "" })));
    });
  }, [user]);

  function handleFile(e) {
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
      const b64 = preview.split(",")[1];
      const system = await buildSystemPrompt("nutrition", user?.uid, null);
      const text = await callAI({
        system,
        userMessage: "Estimate the macros for this meal. Be real about whether this fits the user's goal.",
        imageBase64: b64,
        imageMime: image.type || "image/jpeg",
        maxTokens: 600,
      });
      const parsed = parseAIJson(text);
      setResult(parsed);
      const entry = { ...parsed, time:new Date().toLocaleTimeString(), date:today };
      setLog(l => [entry, ...l].slice(0,20));
      if (user) await saveNutritionEntry(user.uid, entry);
      toast(`Scanned: ${parsed.meal} — ${parsed.calories} cal`, "success");
    } catch(e) {
      if (e.message==="NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Scan failed", "error");
      console.error(e);
    } finally { setScanning(false); }
  }

  const totals = log.reduce((a,i) => ({ cal:a.cal+(i.calories||0), protein:a.protein+(i.protein||0), carbs:a.carbs+(i.carbs||0), fat:a.fat+(i.fat||0) }), {cal:0,protein:0,carbs:0,fat:0});

  return (
    <div className="page-content">
      <div className="page-header"><div><h1 className="page-title">🥗 Nutrition Scanner</h1><p className="page-sub">Snap a photo of your meal for instant macro estimates</p></div></div>
      <div className="nutrition-layout">
        <div className="nutrition-left">
          <div className="upload-zone" onClick={() => fileRef.current.click()}>
            {preview ? <img src={preview} alt="meal" style={{ width:"100%",height:"100%",objectFit:"cover",borderRadius:10 }}/> : <><div style={{ fontSize:48 }}>📸</div><p>Click to upload meal photo</p></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>
          <button className="btn-primary" onClick={scan} disabled={!image||scanning} style={{ marginTop:12 }}>
            {scanning ? "🔍 Scanning…" : "Scan Meal"}
          </button>
          {result && (
            <div className="macro-result">
              <h3>{result.meal}</h3>
              <div className="macro-grid">
                {[["Calories",result.calories,"#FF4D4D"],["Protein",`${result.protein}g`,"#4DC9FF"],["Carbs",`${result.carbs}g`,"#FFD700"],["Fat",`${result.fat}g`,"#00FF88"]].map(([k,v,c])=>(
                  <div key={k} className="macro-tile" style={{ borderColor:c }}><div className="macro-val" style={{ color:c }}>{v}</div><div className="macro-key">{k}</div></div>
                ))}
              </div>
              {result.items?.length>0 && <div className="food-items">{result.items.map((item,i)=><div key={i} className="food-item"><span>{item.name}</span><span style={{ color:"#FFD700" }}>{item.calories} cal</span><span style={{ color:"#4DC9FF" }}>{item.protein}g P</span></div>)}</div>}
              {result.tip && <div className="nutrition-tip">💡 {result.tip}</div>}
            </div>
          )}
        </div>
        <div className="nutrition-right">
          <div className="daily-summary">
            <h3>Today's Total</h3>
            <div className="daily-macros">
              {[["cal",totals.cal,"#FF4D4D"],["protein",`${totals.protein}g`,"#4DC9FF"],["carbs",`${totals.carbs}g`,"#FFD700"],["fat",`${totals.fat}g`,"#00FF88"]].map(([k,v,c])=>(
                <div key={k}><span className="dm-val" style={{ color:c }}>{v}</span><span className="dm-key">{k}</span></div>
              ))}
            </div>
          </div>
          <h4 style={{ color:"#666",fontSize:12,textTransform:"uppercase",letterSpacing:1,margin:"20px 0 10px" }}>Meal Log</h4>
          {log.length===0 && <p style={{ color:"#444",fontSize:14 }}>No meals scanned yet.</p>}
          {log.map((item,i) => <div key={i} className="log-entry"><div style={{ fontWeight:600,fontSize:14 }}>{item.meal}</div><div style={{ fontSize:12,color:"#666" }}>{item.time}</div><div style={{ fontSize:12,color:"#FFD700" }}>{item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F</div></div>)}
        </div>
      </div>
    </div>
  );
}
