import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { addGymRecord } from "../lib/firebase";

const PRESETS = ["Bench Press","Squat","Deadlift","Overhead Press","Pull-ups","Barbell Row","Dips","Bicep Curl","Tricep Pushdown","Leg Press","Romanian Deadlift","Hip Thrust","Incline Press","Lat Pulldown","Cable Fly","Run (miles)","Custom…"];

export default function GymRecords() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm]     = useState({ exercise:"", weight:"", reps:"", sets:"", notes:"", date:new Date().toISOString().split("T")[0] });
  const [customEx, setCustomEx] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");
  const [tab, setTab]       = useState("log"); // log | history | prs

  const records = [...(profile?.gymRecords||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // PR per exercise (best weight × reps via Epley 1RM)
  const prs = {};
  records.forEach(r => {
    const oneRM = r.weight * (1 + r.reps/30);
    if (!prs[r.exercise] || oneRM > prs[r.exercise].oneRM)
      prs[r.exercise] = { ...r, oneRM: Math.round(oneRM) };
  });

  const exercises = ["All", ...Object.keys(prs)];
  const filtered  = filter==="All" ? records : records.filter(r=>r.exercise===filter);

  async function save() {
    const ex = form.exercise==="Custom…" ? customEx : form.exercise;
    if (!ex||!form.weight||!form.reps) return;
    setSaving(true);
    await addGymRecord(user.uid,{ exercise:ex, weight:+form.weight, reps:+form.reps, sets:+form.sets||1, notes:form.notes, date:form.date });
    await refreshProfile();
    setForm(f=>({...f,exercise:"",weight:"",reps:"",sets:"",notes:""}));
    setSaving(false);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🏋️ Gym Records</h1><p className="page-sub">Track every lift. Own every PR.</p></div>
      </div>

      <div className="tabs">
        {["log","prs","history"].map(t=>(
          <button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t==="log"?"➕ Log Set":t==="prs"?"🏅 PRs":"📜 History"}
          </button>
        ))}
      </div>

      {tab==="log" && (
        <div className="form-card">
          <div className="form-row">
            <select className="inp" value={form.exercise} onChange={e=>setForm(f=>({...f,exercise:e.target.value}))}>
              <option value="">Exercise…</option>
              {PRESETS.map(e=><option key={e}>{e}</option>)}
            </select>
            {form.exercise==="Custom…" && <input className="inp" placeholder="Exercise name" value={customEx} onChange={e=>setCustomEx(e.target.value)}/>}
          </div>
          <div className="form-row">
            <input className="inp" type="number" placeholder="Weight (lbs)" value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))}/>
            <input className="inp" type="number" placeholder="Reps"         value={form.reps}   onChange={e=>setForm(f=>({...f,reps:e.target.value}))}/>
            <input className="inp" type="number" placeholder="Sets"         value={form.sets}   onChange={e=>setForm(f=>({...f,sets:e.target.value}))}/>
            <input className="inp" type="date"                               value={form.date}   onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <input className="inp" placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{width:"100%"}}/>
          <button className="btn-primary" onClick={save} disabled={saving} style={{marginTop:12,width:"auto",padding:"10px 32px"}}>
            {saving?"Saving…":"Log Set"}
          </button>
        </div>
      )}

      {tab==="prs" && (
        <div className="pr-grid">
          {Object.entries(prs).map(([ex,pr])=>(
            <div key={ex} className="pr-card">
              <div className="pr-ex">{ex}</div>
              <div className="pr-weight">{pr.weight}<span style={{fontSize:14,color:"#888"}}> lbs</span></div>
              <div className="pr-detail">{pr.reps} reps × {pr.sets} sets</div>
              <div className="pr-1rm">~{pr.oneRM} lbs est. 1RM</div>
              <div className="pr-date">{pr.date}</div>
            </div>
          ))}
          {Object.keys(prs).length===0 && <p className="empty">No records yet. Log your first set!</p>}
        </div>
      )}

      {tab==="history" && (
        <>
          <div className="filter-row">
            <select className="inp" value={filter} onChange={e=>setFilter(e.target.value)}>
              {exercises.map(e=><option key={e}>{e}</option>)}
            </select>
          </div>
          <div className="record-table">
            <div className="record-thead">
              <span>Date</span><span>Exercise</span><span>Weight</span><span>Reps×Sets</span><span>Notes</span>
            </div>
            {filtered.map(r=>(
              <div key={r.id} className="record-row">
                <span style={{color:"#666",fontFamily:"monospace",fontSize:12}}>{r.date}</span>
                <span style={{fontWeight:600}}>{r.exercise}</span>
                <span style={{color:"#FFD700"}}>{r.weight} lbs</span>
                <span style={{color:"#888"}}>{r.reps}×{r.sets}</span>
                <span style={{color:"#555",fontSize:12}}>{r.notes}</span>
              </div>
            ))}
            {filtered.length===0 && <p className="empty">No records match.</p>}
          </div>
        </>
      )}
    </div>
  );
}
