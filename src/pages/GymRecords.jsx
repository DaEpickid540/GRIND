import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { addGymRecord, getGymRecords, deleteGymRecord } from "../lib/firebase";
import { useToast } from "../components/Toast";
import { callAI } from "../lib/aiProvider";
import { buildKnowledgeContext } from "../lib/knowledgeBase";

const PRESETS = ["Bench Press","Squat","Deadlift","Overhead Press","Pull-ups","Barbell Row","Dips","Bicep Curl","Tricep Pushdown","Leg Press","Romanian Deadlift","Hip Thrust","Incline Press","Lat Pulldown","Cable Fly","Run (miles)","Custom…"];

// ── AI helpers ───────────────────────────────────────────────────────────────
function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

const WORKOUT_GOALS  = ["Build muscle", "Lose fat / cut", "Strength", "Endurance / conditioning", "General fitness"];
const WORKOUT_LEVELS = ["Beginner", "Intermediate", "Advanced"];

// ── AI Workout Plan Generator (mirrors the Nutrition meal-plan generator) ───
function WorkoutPlanGen({ user }) {
  const toast = useToast();
  const [days,      setDays]      = useState(3);
  const [goal,      setGoal]      = useState(WORKOUT_GOALS[0]);
  const [level,     setLevel]     = useState("Intermediate");
  const [equipment, setEquipment] = useState("");
  const [notes,     setNotes]     = useState("");
  const [plan,      setPlan]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState({});

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const eqStr   = equipment.trim() ? `Available equipment: ${equipment.trim()}.` : "Assume access to a standard full gym.";
      const noteStr = notes.trim() ? `Limitations/notes — respect these strictly, avoid risky movements where injuries are mentioned: ${notes.trim()}.` : "";

      const userMessage = `Generate a ${days}-day workout plan / training split. Goal: ${goal}. Experience level: ${level}. ${eqStr} ${noteStr}

Return ONLY valid JSON in this exact structure — no other text:
{
  "days": [
    {
      "day": "Day 1 — Push",
      "focus": "Chest, Shoulders, Triceps",
      "exercises": [
        { "name": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest": "90s", "notes": "Controlled tempo, full range of motion" }
      ],
      "estimatedDuration": "55 min"
    }
  ],
  "summary": "2-3 sentences on why this split fits the stated goal, level, and equipment."
}`;

      const knowledge = buildKnowledgeContext("workoutPlan");
      const system = [
        "You are an expert strength & conditioning coach. Output only valid JSON, no markdown fencing outside the object. Tailor exercise selection strictly to the stated equipment and experience level, and respect any injuries/limitations mentioned — substitute safer alternatives where needed.",
        knowledge,
      ].filter(Boolean).join("\n\n");

      const text = await callAI({
        system,
        userMessage,
        maxTokens: days <= 3 ? 1800 : days <= 5 ? 2800 : 3800,
      });

      const parsed = parseAIJson(text);
      setPlan(parsed);
      setExpanded({ 0: true });
      toast("Workout plan ready! 💪", "success");
    } catch (e) {
      if (e.message === "NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Generation failed — try again", "error");
      console.error(e);
    } finally { setLoading(false); }
  }

  return (
    <div className="meal-plan-section">
      <div className="mp-controls card">
        <div className="mp-control-row">
          <div className="mp-control-group">
            <label className="mp-label">Plan length</label>
            <div className="mp-day-btns">
              {[3, 5, 7].map(d => (
                <button key={d} className={`mp-day-btn${days===d?" active":""}`} onClick={() => setDays(d)}>
                  {d} Days
                </button>
              ))}
            </div>
          </div>
          <div className="mp-control-group">
            <label className="mp-label">Goal</label>
            <select className="mp-input" value={goal} onChange={e => setGoal(e.target.value)}>
              {WORKOUT_GOALS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="mp-control-row" style={{ marginTop:12 }}>
          <div className="mp-control-group">
            <label className="mp-label">Experience level</label>
            <div className="mp-day-btns">
              {WORKOUT_LEVELS.map(l => (
                <button key={l} className={`mp-day-btn${level===l?" active":""}`} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="mp-control-group">
            <label className="mp-label">Equipment <span style={{ color:"#555" }}>(optional)</span></label>
            <input className="mp-input" type="text" placeholder="e.g. Full gym, dumbbells only, bodyweight…"
              value={equipment} onChange={e => setEquipment(e.target.value)}/>
          </div>
        </div>
        <div className="mp-control-group" style={{ marginTop:12 }}>
          <label className="mp-label">Limitations / focus notes <span style={{ color:"#555" }}>(optional)</span></label>
          <input className="mp-input" type="text" placeholder="e.g. bad left knee — avoid heavy squats, prioritize upper body…"
            value={notes} onChange={e => setNotes(e.target.value)} maxLength={120}/>
        </div>
        <button className="btn-primary mp-generate-btn" onClick={generate} disabled={loading}>
          {loading ? "⏳ Generating…" : `✨ Generate ${days}-Day Workout Plan`}
        </button>
      </div>

      {loading && (
        <div className="loading-card" style={{ marginTop:20 }}>
          <div className="spinner"/>
          <p>Building your training split…</p>
        </div>
      )}

      {!loading && plan && (
        <div className="mp-plan">
          {plan.summary && <div className="mp-summary">💬 {plan.summary}</div>}
          {plan.days?.map((day, di) => (
            <div key={di} className="mp-day-card">
              <button className="mp-day-header" onClick={() => setExpanded(e => ({ ...e, [di]: !e[di] }))}>
                <span className="mp-day-title">{day.day}</span>
                <div className="mp-day-totals">
                  {day.focus && <span style={{ color:"#4DC9FF" }}>{day.focus}</span>}
                  {day.estimatedDuration && <span style={{ color:"#FFD700" }}>⏱ {day.estimatedDuration}</span>}
                </div>
                <span className="mp-day-chevron">{expanded[di] ? "▲" : "▼"}</span>
              </button>
              {expanded[di] && (
                <div className="mp-meals">
                  {day.exercises?.map((ex, ei) => (
                    <div key={ei} className="mp-meal-row">
                      <span className="mp-meal-type">{ex.sets}×{ex.reps}</span>
                      <div className="mp-meal-info">
                        <div className="mp-meal-name">{ex.name}</div>
                        {ex.notes && <div className="mp-meal-desc">{ex.notes}</div>}
                        {ex.rest && <div className="mp-meal-macros"><span style={{ color:"#888" }}>Rest: {ex.rest}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !plan && (
        <div className="empty-state-card" style={{ marginTop:20 }}>
          <p style={{ color:"#555" }}>
            Pick your goal, level, and equipment, then hit Generate — the AI will build a
            full multi-day training split tailored to you, exercise-by-exercise.
          </p>
        </div>
      )}
    </div>
  );
}

export default function GymRecords() {
  const { user } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ exercise:"", weight:"", reps:"", sets:"", notes:"", date:new Date().toISOString().split("T")[0] });
  const [customEx, setCustomEx] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");
  const [tab, setTab]       = useState("log"); // log | history | prs | ai_plan

  // Load records from subcollection
  useEffect(() => {
    if (!user) return;
    getGymRecords(user.uid).then(r => { setRecords(r); setLoading(false); });
  }, [user]);

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
    try {
      await addGymRecord(user.uid,{ exercise:ex, weight:+form.weight, reps:+form.reps, sets:+form.sets||1, notes:form.notes, date:form.date });
      const updated = await getGymRecords(user.uid);
      setRecords(updated);
      setForm(f=>({...f,exercise:"",weight:"",reps:"",sets:"",notes:""}));
      toast("Set logged! 💪", "success", 2000);
    } catch(e) { toast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleDelete(record) {
    if (!confirm(`Delete this ${record.exercise} record?`)) return;
    try {
      await deleteGymRecord(user.uid, record.id);
      setRecords(r => r.filter(x => x.id !== record.id));
      toast("Record deleted", "info", 2000);
    } catch(e) { toast("Delete failed", "error"); }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🏋️ Gym Records</h1><p className="page-sub">Track every lift. Own every PR.</p></div>
      </div>

      <div className="tabs">
        {["log","prs","history","ai_plan"].map(t=>(
          <button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t==="log"?"➕ Log Set":t==="prs"?"🏅 PRs":t==="history"?"📜 History":"🤖 AI Workout Plans"}
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
          {loading && <div className="loading-card"><div className="spinner"/></div>}
          <div className="record-table">
            <div className="record-thead" style={{gridTemplateColumns:"100px 1fr 100px 80px 1fr 36px"}}>
              <span>Date</span><span>Exercise</span><span>Weight</span><span>Reps×Sets</span><span>Notes</span><span></span>
            </div>
            {filtered.map(r=>(
              <div key={r.id} className="record-row" style={{gridTemplateColumns:"100px 1fr 100px 80px 1fr 36px"}}>
                <span style={{color:"#666",fontFamily:"monospace",fontSize:12}}>{r.date}</span>
                <span style={{fontWeight:600}}>{r.exercise}</span>
                <span style={{color:"#FFD700"}}>{r.weight} lbs</span>
                <span style={{color:"#888"}}>{r.reps}×{r.sets}</span>
                <span style={{color:"#555",fontSize:12}}>{r.notes}</span>
                <button className="habit-remove" onClick={()=>handleDelete(r)} aria-label={`Delete ${r.exercise} record`} title="Delete">🗑</button>
              </div>
            ))}
            {!loading && filtered.length===0 && <p className="empty">No records match.</p>}
          </div>
        </>
      )}

      {tab==="ai_plan" && <WorkoutPlanGen user={user} />}
    </div>
  );
}
