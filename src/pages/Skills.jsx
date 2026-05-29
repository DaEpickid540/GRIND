import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { getSkills, createSkill, logSkillSession, getSkillSessions } from "../lib/firebase";
import { useToast } from "../components/Toast";

const SKILL_ICONS = ["🎸","⚽","🏀","🎾","🥊","🏊","🎯","🎮","🎹","🎨","✍️","📖","🗣️","🤸","🏋️","🧗","🎭","💻","🔧","🎺","🥋","🏄","🚴","🧘","🎻","🎤"];
const SKILL_CATS  = ["Sport","Music","Art","Academics","Fitness","Tech","Language","Other"];

function LevelRing({ level, xp, maxXP, size=64, color="#FFD700" }) {
  const pct  = maxXP ? Math.min((xp % maxXP) / maxXP * 100, 100) : 0;
  const r    = (size - 6) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1a" strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round"
        style={{ transition:"stroke-dashoffset .6s ease" }}/>
    </svg>
  );
}

function HeatMap({ sessions }) {
  const today = new Date();
  const days  = Array.from({ length: 91 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (90 - i));
    return d.toISOString().split("T")[0];
  });
  const doneSet = new Set(sessions.map(s => s.date));
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i+7));
  return (
    <div className="heatmap">
      {weeks.map((week, wi) => (
        <div key={wi} className="heatmap-col">
          {week.map(day => (
            <div key={day} className={`heatmap-cell ${doneSet.has(day)?"active":""}`}
              title={day} style={{ background: doneSet.has(day) ? "var(--accent)" : undefined }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Skills() {
  const { user } = useAuth();
  const toast = useToast();
  const [skills,     setSkills]     = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [sessions,   setSessions]   = useState([]);
  const [tab,        setTab]        = useState("overview"); // overview | log | history
  const [showCreate, setShowCreate] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const [newSkill, setNewSkill] = useState({ name:"", icon:"🎯", category:"Sport", description:"" });
  const [logForm,  setLogForm]  = useState({ duration:30, rating:3, notes:"", date:new Date().toISOString().split("T")[0] });

  useEffect(() => {
    if (!user) return;
    getSkills(user.uid).then(s => { setSkills(s); setLoading(false); });
  }, [user]);

  async function loadSessions(skill) {
    const s = await getSkillSessions(user.uid, skill.id);
    setSessions(s);
  }

  function selectSkill(skill) {
    setSelected(skill);
    setTab("overview");
    loadSessions(skill);
  }

  async function handleCreate() {
    if (!newSkill.name.trim()) { toast("Enter a skill name","warning"); return; }
    await createSkill(user.uid, newSkill);
    const updated = await getSkills(user.uid);
    setSkills(updated);
    setShowCreate(false);
    setNewSkill({ name:"", icon:"🎯", category:"Sport", description:"" });
    toast(`${newSkill.icon} ${newSkill.name} added!`, "success");
  }

  async function handleLog() {
    if (!selected) return;
    await logSkillSession(user.uid, selected.id, logForm);
    const updated = await getSkills(user.uid);
    setSkills(updated);
    const sel = updated.find(s => s.id === selected.id);
    setSelected(sel);
    await loadSessions(sel);
    setLogForm(f => ({ ...f, notes:"", rating:3 }));
    const xpGained = Math.round((logForm.duration/10) * logForm.rating);
    toast(`+${xpGained} XP for ${sel.name}! 🔥`, "xp");
  }

  const xpToNextLevel = (lvl) => (lvl * lvl) * 50;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🎯 Skills</h1><p className="page-sub">Track every skill you're building. Log sessions. Level up.</p></div>
        <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ width:"auto", padding:"10px 24px" }}>+ New Skill</button>
      </div>

      <div className="skills-layout">
        {/* Skills list */}
        <div className="skills-list">
          {loading && <div className="loading-card"><div className="spinner"/></div>}
          {!loading && skills.length===0 && (
            <div className="empty-state-card">
              <div style={{ fontSize:56 }}>🎯</div>
              <h3>No skills yet</h3>
              <p>Add a skill you're working on — guitar, basketball, coding, anything.</p>
            </div>
          )}
          {skills.map(skill => {
            const maxXP  = xpToNextLevel(skill.level||1);
            const active = selected?.id===skill.id;
            return (
              <div key={skill.id} className={`skill-card ${active?"active":""}`} onClick={() => selectSkill(skill)}>
                <div className="skill-card-icon">{skill.icon}</div>
                <div className="skill-card-info">
                  <div className="skill-card-name">{skill.name}</div>
                  <div className="skill-card-cat">{skill.category}</div>
                  <div className="skill-card-stats">
                    <span>Lv {skill.level||1}</span>
                    <span>·</span>
                    <span>{Math.round((skill.totalMinutes||0)/60)}h logged</span>
                    <span>·</span>
                    <span>{skill.sessions||0} sessions</span>
                  </div>
                </div>
                <div style={{ position:"relative", flexShrink:0 }}>
                  <LevelRing level={skill.level||1} xp={skill.xp||0} maxXP={maxXP} size={52} color="#FFD700"/>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontFamily:"'Bebas Neue',sans-serif", color:"#FFD700" }}>{skill.level||1}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="skill-detail">
            <div className="skill-detail-header">
              <span style={{ fontSize:40 }}>{selected.icon}</span>
              <div style={{ flex:1 }}>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:1, lineHeight:1 }}>{selected.name}</h2>
                <div style={{ fontSize:13, color:"#888" }}>{selected.category} {selected.description && `· ${selected.description}`}</div>
              </div>
              <div className="skill-level-badge">
                <LevelRing level={selected.level||1} xp={selected.xp||0} maxXP={xpToNextLevel(selected.level||1)} size={72} color="#FFD700"/>
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"#FFD700", lineHeight:1 }}>{selected.level||1}</div>
                  <div style={{ fontSize:9, color:"#888" }}>LEVEL</div>
                </div>
              </div>
            </div>

            {/* XP bar */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#666", marginBottom:4 }}>
                <span>{selected.xp||0} XP</span>
                <span>{xpToNextLevel(selected.level||1)} XP to Lv {(selected.level||1)+1}</span>
              </div>
              <div className="level-bar-bg">
                <div className="level-bar-fill" style={{ width:`${((selected.xp||0) % xpToNextLevel(selected.level||1)) / xpToNextLevel(selected.level||1) * 100}%`, background:"#FFD700" }}/>
              </div>
            </div>

            {/* Big stats */}
            <div className="skill-stats-row">
              {[
                ["⏱", Math.round((selected.totalMinutes||0)/60), "hours"],
                ["📅", selected.sessions||0, "sessions"],
                ["🔥", selected.lastPracticed||"—", "last session"],
              ].map(([icon,val,label]) => (
                <div key={label} className="skill-stat">
                  <span style={{ fontSize:20 }}>{icon}</span>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:"#FFD700", lineHeight:1 }}>{val}</span>
                  <span style={{ fontSize:11, color:"#888" }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom:16 }}>
              {["overview","log","history"].map(t => (
                <button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={() => setTab(t)}>
                  {t==="overview"?"📊 Overview":t==="log"?"➕ Log Session":"📜 History"}
                </button>
              ))}
            </div>

            {tab==="overview" && (
              <div>
                <h4 style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Practice Heatmap (last 13 weeks)</h4>
                <HeatMap sessions={sessions}/>
              </div>
            )}

            {tab==="log" && (
              <div className="log-form">
                <div className="form-row">
                  <div style={{ flex:1 }}>
                    <label className="field-label">Duration (minutes)</label>
                    <input className="inp" type="number" min={1} value={logForm.duration}
                      onChange={e => setLogForm(f=>({...f,duration:+e.target.value}))}/>
                  </div>
                  <div>
                    <label className="field-label">Date</label>
                    <input className="inp" type="date" value={logForm.date}
                      onChange={e => setLogForm(f=>({...f,date:e.target.value}))}/>
                  </div>
                </div>
                <label className="field-label" style={{ marginBottom:8, display:"block" }}>Session Rating</label>
                <div className="rating-row">
                  {[1,2,3,4,5].map(r => (
                    <button key={r} className={`rating-btn ${logForm.rating>=r?"active":""}`}
                      onClick={() => setLogForm(f=>({...f,rating:r}))}>⭐</button>
                  ))}
                  <span style={{ fontSize:12, color:"#888", marginLeft:8 }}>
                    {["","Rough","Okay","Good","Great","🔥 Flow state"][logForm.rating]}
                  </span>
                </div>
                <label className="field-label" style={{ marginBottom:6, display:"block", marginTop:12 }}>Notes</label>
                <textarea className="inp" rows={3} placeholder="What did you work on? Any breakthroughs?"
                  value={logForm.notes} onChange={e => setLogForm(f=>({...f,notes:e.target.value}))}
                  style={{ resize:"vertical" }}/>
                <button className="btn-primary" onClick={handleLog} style={{ marginTop:12, width:"auto", padding:"10px 32px" }}>
                  Log Session (+{Math.round((logForm.duration/10)*logForm.rating)} XP)
                </button>
              </div>
            )}

            {tab==="history" && (
              <div className="session-history">
                {sessions.length===0 && <p className="empty">No sessions logged yet.</p>}
                {sessions.map(s => (
                  <div key={s.id} className="session-row">
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontFamily:"monospace", fontSize:12, color:"#666" }}>{s.date}</span>
                      <div style={{ display:"flex", gap:4 }}>
                        {Array.from({length:s.rating||3}).map((_,i)=><span key={i} style={{ fontSize:11 }}>⭐</span>)}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:12, fontSize:13, marginBottom:4 }}>
                      <span style={{ color:"#FFD700" }}>⏱ {s.duration} min</span>
                      <span style={{ color:"#4DC9FF" }}>+{Math.round((s.duration/10)*(s.rating||3))} XP</span>
                    </div>
                    {s.notes && <div style={{ fontSize:13, color:"#888" }}>{s.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="skill-detail-empty">
            <div style={{ fontSize:64, marginBottom:16 }}>🎯</div>
            <p style={{ color:"#555" }}>Select a skill to see details</p>
          </div>
        )}
      </div>

      {/* Create skill modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:480 }}>
            <h3>New Skill</h3>
            <p>Track any skill you're actively building.</p>
            <label className="field-label">Name</label>
            <input className="inp" placeholder="e.g. Acoustic Guitar" value={newSkill.name}
              onChange={e => setNewSkill(s=>({...s,name:e.target.value}))} style={{ marginBottom:12 }}/>
            <label className="field-label">Category</label>
            <select className="inp" value={newSkill.category}
              onChange={e => setNewSkill(s=>({...s,category:e.target.value}))} style={{ marginBottom:12 }}>
              {SKILL_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <label className="field-label">Description (optional)</label>
            <input className="inp" placeholder="e.g. Learning fingerpicking, working toward songs"
              value={newSkill.description} onChange={e => setNewSkill(s=>({...s,description:e.target.value}))}
              style={{ marginBottom:12 }}/>
            <label className="field-label">Icon</label>
            <div className="icon-grid">
              {SKILL_ICONS.map(icon => (
                <button key={icon} className={`icon-btn ${newSkill.icon===icon?"active":""}`}
                  onClick={() => setNewSkill(s=>({...s,icon}))}>
                  {icon}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button className="btn-primary" onClick={handleCreate} style={{ width:"auto", padding:"10px 28px" }}>Create Skill</button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
