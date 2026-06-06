import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { saveWeeklyPlan, togglePlanTask } from "../lib/firebase";
import { useToast } from "../components/Toast";
import { callAI } from "../lib/aiProvider";
import { buildSystemPrompt } from "../lib/coachVoice";

// Robust JSON extractor — handles markdown fences, preamble text, trailing commentary
function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

const SLOTS = ["Morning","Afternoon","Evening"];
const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOT_ICONS  = { Morning:"☀️", Afternoon:"🌤️", Evening:"🌙" };
const SLOT_COLORS = { Morning:"#FFD700", Afternoon:"#FF9800", Evening:"#4DC9FF" };
const CAT_COLORS  = { fitness:"#FF4D4D", selfcare:"#4DC9FF", school:"#FFD700", coding:"#00FF88", social:"#FF88FF" };

export default function WeeklyPlan() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [plan,       setPlan]       = useState(profile?.weeklyPlan || null);
  const [tasksDone,  setTasksDone]  = useState(profile?.planTasksDone || {});

  const todayName   = DAYS[new Date().getDay()===0 ? 6 : new Date().getDay()-1];
  const [expanded,  setExpanded]   = useState(todayName);

  async function generatePlan() {
    setGenerating(true);
    try {
      const system = await buildSystemPrompt("weeklyPlan", user.uid, profile);

      const text = await callAI({
        system,
        userMessage: `Generate this week's plan. Today is ${new Date().toLocaleDateString()}.`,
        maxTokens: 2000,
      });

      const parsed = parseAIJson(text);
      setPlan(parsed);
      setTasksDone({});
      await saveWeeklyPlan(user.uid, parsed);
      await refreshProfile();
      toast("Weekly plan generated! ✨", "success");
    } catch(e) {
      if (e.message==="NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Failed to generate plan", "error");
      console.error(e);
    } finally { setGenerating(false); }
  }

  async function handleToggleTask(day, slot) {
    const key     = `${day}_${slot}`;
    const current = !!tasksDone[key];
    const updated = { ...tasksDone, [key]: !current };
    setTasksDone(updated);
    await togglePlanTask(user.uid, key, current);
    if (!current) toast(`${SLOT_ICONS[slot]} ${slot} task done!`, "success", 2000);
  }

  const totalTasks = plan ? DAYS.length * SLOTS.length : 0;
  const doneTasks  = Object.values(tasksDone).filter(Boolean).length;
  const weekPct    = totalTasks ? Math.round((doneTasks/totalTasks)*100) : 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">📋 Weekly Plan</h1><p className="page-sub">AI-generated daily structure — check off tasks as you go</p></div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          {plan && <div className="week-progress-chip"><span style={{ color:"#FFD700", fontFamily:"monospace" }}>{doneTasks}/{totalTasks}</span><span style={{ color:"#555" }}>&nbsp;done ({weekPct}%)</span></div>}
          <button className="btn-primary" onClick={generatePlan} disabled={generating} style={{ width:"auto", padding:"10px 24px" }}>
            {generating ? "⏳ Generating…" : plan ? "🔄 Regenerate" : "✨ Generate Plan"}
          </button>
        </div>
      </div>

      {!plan && !generating && (
        <div className="empty-state-card">
          <div style={{ fontSize:72 }}>📋</div>
          <h3>No plan yet</h3>
          <p>Hit "Generate Plan" and your AI will build a full 7-day Morning/Afternoon/Evening schedule.</p>
          <button className="btn-primary" onClick={generatePlan} style={{ width:"auto", padding:"12px 32px", marginTop:8 }}>✨ Generate My Plan</button>
        </div>
      )}

      {generating && <div className="loading-card"><div className="spinner"/><p>Building your 7-day plan…</p></div>}

      {plan && (
        <>
          <div className="week-bar-card">
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:12, color:"#888", textTransform:"uppercase", letterSpacing:.5 }}>Week Progress</span>
              <span style={{ fontSize:12, color:"#FFD700", fontFamily:"monospace" }}>{weekPct}%</span>
            </div>
            <div className="level-bar-bg"><div className="level-bar-fill" style={{ width:`${weekPct}%`, background:"#FFD700" }}/></div>
          </div>

          <div className="plan-days">
            {DAYS.map(day => {
              const dayPlan = plan.days?.[day];
              const isToday = day===todayName, isOpen = expanded===day;
              const dayDone = SLOTS.filter(s => tasksDone[`${day}_${s}`]).length;
              return (
                <div key={day} className={`plan-day ${isToday?"today":""} ${isOpen?"open":""}`}>
                  <button className="plan-day-header" onClick={() => setExpanded(isOpen?null:day)}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                      <span className="plan-day-name">{day}</span>
                      {isToday && <span className="today-badge">TODAY</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ display:"flex", gap:4 }}>
                        {SLOTS.map(s => <div key={s} style={{ width:8, height:8, borderRadius:"50%", background:tasksDone[`${day}_${s}`]?SLOT_COLORS[s]:"#2a2a2a" }}/>)}
                      </div>
                      <span style={{ fontSize:12, color:"#555" }}>{dayDone}/3</span>
                      <span className="plan-chevron">{isOpen?"▼":"▶"}</span>
                    </div>
                  </button>
                  {isOpen && dayPlan && (
                    <div className="plan-slots">
                      {SLOTS.map(slot => {
                        const s = dayPlan[slot], k = `${day}_${slot}`, done = !!tasksDone[k];
                        if (!s) return null;
                        return (
                          <div key={slot} className={`plan-slot ${done?"done":""}`} onClick={() => handleToggleTask(day, slot)} style={{ cursor:"pointer" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                              <div className="slot-label" style={{ color:SLOT_COLORS[slot] }}>{SLOT_ICONS[slot]} {slot}</div>
                              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                                {s.category && <span style={{ fontSize:10, color:CAT_COLORS[s.category]||"#888", border:`1px solid ${CAT_COLORS[s.category]||"#888"}`, borderRadius:4, padding:"1px 6px", textTransform:"uppercase", letterSpacing:.5 }}>{s.category}</span>}
                                <div className={`task-check ${done?"checked":""}`}>{done?"✓":""}</div>
                              </div>
                            </div>
                            <div className="slot-task" style={{ opacity:done?.4:1, textDecoration:done?"line-through":"none" }}>{s.task}</div>
                            {!done && <div className="slot-why">{s.why}</div>}
                            {s.duration && <div className="slot-duration">⏱ {s.duration}</div>}
                          </div>
                        );
                      })}
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
