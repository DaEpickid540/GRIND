import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { getLevelInfo, LEVELS, HABIT_CATEGORIES } from "../data/gameData";
import { callAI } from "../lib/aiProvider";
import { buildKnowledgeContext } from "../lib/knowledgeBase";
import { useToast } from "../components/Toast";

// ── Export & AI-insights helpers ─────────────────────────────────────────────
function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

function checkinStats(c) {
  const vals  = Object.values(c.habits || {});
  const done  = vals.filter(Boolean).length;
  const total = vals.length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportCSV(checkins) {
  const headers = ["Date", "XP Gained", "Habits Completed", "Total Habits", "Completion %"];
  const rows = checkins.map(c => {
    const { done, total, pct } = checkinStats(c);
    return [c.date, c.xpGained || 0, done, total, pct];
  });
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  downloadBlob(csv, `grind-checkins-${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
}

async function exportPDF(profile, checkins, li, insights) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 20;
  const nl = (n = 7) => { y += n; if (y > pageH - 20) { doc.addPage(); y = 20; } };

  doc.setFont(undefined, "bold"); doc.setFontSize(22);
  doc.text("⚡ GRIND Progress Report", 14, y); nl(10);
  doc.setFont(undefined, "normal"); doc.setFontSize(11);
  doc.text(`Generated ${new Date().toLocaleDateString()} for ${profile?.displayName || "you"}`, 14, y); nl(12);

  doc.setFont(undefined, "bold"); doc.setFontSize(14); doc.text("Summary", 14, y); nl(8);
  doc.setFont(undefined, "normal"); doc.setFontSize(11);
  [
    `Level ${profile?.level || 1} — ${li?.current?.title || "Rookie"}`,
    `Total XP: ${profile?.xp || 0}`,
    `Current streak: ${profile?.streak || 0} day(s)`,
    `Best streak: ${profile?.longestStreak || 0} day(s)`,
    `Total check-ins logged: ${checkins.length}`,
  ].forEach(line => { doc.text(`•  ${line}`, 14, y); nl(); });

  nl(4);
  doc.setFont(undefined, "bold"); doc.setFontSize(14); doc.text("Recent Check-ins", 14, y); nl(8);
  doc.setFont(undefined, "normal"); doc.setFontSize(10);
  [...checkins].slice(-20).reverse().forEach(c => {
    const { done, total, pct } = checkinStats(c);
    doc.text(`${c.date}  —  ${done}/${total} habits (${pct}%)  ·  +${c.xpGained || 0} XP`, 14, y);
    nl(6);
  });

  if (insights?.length) {
    nl(4);
    doc.setFont(undefined, "bold"); doc.setFontSize(14); doc.text("AI Insights", 14, y); nl(8);
    doc.setFont(undefined, "normal"); doc.setFontSize(10);
    insights.forEach(ins => {
      doc.splitTextToSize(`•  ${ins}`, 180).forEach(line => { doc.text(line, 14, y); nl(6); });
    });
  }

  doc.save(`grind-report-${new Date().toISOString().split("T")[0]}.pdf`);
}

async function generateInsights(checkins, profile) {
  const recent = [...checkins].slice(-30).map(c => {
    const { done, total } = checkinStats(c);
    return `${c.date}: ${done}/${total} habits, +${c.xpGained || 0} XP`;
  }).join("\n");

  const userMessage = `Here is a user's recent habit-tracking history (most recent ${Math.min(30, checkins.length)} entries, oldest first):
${recent}

Profile: Level ${profile?.level || 1}, ${profile?.xp || 0} total XP, ${profile?.streak || 0}-day current streak, ${profile?.longestStreak || 0}-day best streak ever.

Generate 4-6 sharp, specific, encouraging-but-honest insights about their patterns — momentum, consistency, day-of-week trends, plateaus, what's working and what isn't. Reference real numbers from the data where possible. Return ONLY valid JSON in this structure, no other text:
{ "insights": ["...", "..."] }`;

  const knowledge = buildKnowledgeContext("insights");
  const system = [
    "You are a perceptive, data-driven habit coach. Find genuine patterns rather than generic platitudes — be specific and reference the actual numbers given. Output only valid JSON, no markdown fencing.",
    knowledge,
  ].filter(Boolean).join("\n\n");

  const text = await callAI({
    system,
    userMessage,
    maxTokens: 700,
  });
  return parseAIJson(text).insights || [];
}

function ExportSection({ profile, checkins, li }) {
  const toast = useToast();
  const [insights,  setInsights]  = useState(null);
  const [thinking,  setThinking]  = useState(false);
  const [building,  setBuilding]  = useState(false);

  async function handleInsights() {
    if (thinking) return;
    setThinking(true);
    try {
      const list = await generateInsights(checkins, profile);
      setInsights(list);
      toast("Insights generated! 🧠", "success");
    } catch (e) {
      if (e.message === "NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Failed to generate insights — try again", "error");
      console.error(e);
    } finally { setThinking(false); }
  }

  async function handlePDF() {
    if (building) return;
    setBuilding(true);
    try {
      await exportPDF(profile, checkins, li, insights);
      toast("PDF report downloaded 📄", "success");
    } catch (e) { toast("PDF export failed", "error"); console.error(e); }
    finally { setBuilding(false); }
  }

  return (
    <div className="section-card">
      <h3 className="section-title">📤 Export & AI Insights</h3>
      <p style={{ fontSize:13, color:"var(--muted2)", marginBottom:16, lineHeight:1.5 }}>
        Download your progress as a spreadsheet or polished report — or have the AI dig through
        your check-in history for real patterns and honest feedback.
      </p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <button className="btn-secondary" onClick={() => exportCSV(checkins)} disabled={!checkins.length}>
          ⬇️ Export CSV
        </button>
        <button className="btn-secondary" onClick={handlePDF} disabled={building || !checkins.length}>
          {building ? "Building…" : "📄 Export PDF Report"}
        </button>
        <button className="btn-primary" onClick={handleInsights} disabled={thinking || checkins.length < 3} style={{ width:"auto", padding:"10px 20px" }}>
          {thinking ? "🧠 Thinking…" : "✨ Generate AI Insights"}
        </button>
      </div>
      {checkins.length < 3 && <p style={{ fontSize:12, color:"var(--muted)", marginTop:10 }}>Log a few more check-ins to unlock AI insights.</p>}
      {insights?.length > 0 && (
        <div className="ai-insights-list">
          {insights.map((ins, i) => <div key={i} className="ai-insight-item">💡 {ins}</div>)}
        </div>
      )}
    </div>
  );
}

export default function Stats() {
  const { user, profile } = useAuth();
  const [checkins, setCheckins] = useState([]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"grind_users",user.uid,"checkins"),orderBy("timestamp","asc")))
      .then(s=>setCheckins(s.docs.map(d=>({date:d.id,...d.data()}))));
  },[user]);

  const li = profile ? getLevelInfo(profile.xp||0) : null;

  let cumXP = 0;
  const xpChart = checkins.map(c=>{ cumXP+=(c.xpGained||0); return {date:c.date.slice(5),xp:cumXP}; });
  const last14 = checkins.slice(-14).map(c=>{
    const vals = Object.values(c.habits||{}); const d=vals.filter(Boolean).length;
    return {date:c.date.slice(5), pct:vals.length?Math.round((d/vals.length)*100):0};
  });

  // Radar: completion per category — uses user's custom habits if set, else defaults
  const activeCategories = profile?.customHabits || HABIT_CATEGORIES;
  const catRadar = Object.entries(activeCategories).map(([,cat])=>{
    let total=0,done=0;
    checkins.slice(-14).forEach(c=>{ cat.habits.forEach(h=>{ total++; if(c.habits?.[h.id]) done++; }); });
    return { cat:cat.label, value: total ? Math.round((done/total)*100) : 0 };
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          {user?.photoURL && <img src={user.photoURL} className="profile-avatar-lg" referrerPolicy="no-referrer" alt=""/>}
          <div style={{display:"inline-block",verticalAlign:"middle",marginLeft:14}}>
            <h1 className="page-title" style={{marginBottom:2}}>{user?.displayName}</h1>
            {li && <p className="page-sub" style={{color:li.current.color}}>{li.current.emoji} {li.current.title} · Level {profile?.level}</p>}
          </div>
        </div>
      </div>

      {/* Big stats */}
      <div className="big-stats-row">
        {[
          {val:profile?.xp||0,         label:"Total XP",     color:"#FFD700"},
          {val:profile?.streak||0,      label:"Current Streak",color:"#FF4D4D"},
          {val:profile?.longestStreak||0,label:"Best Streak", color:"#FF9800"},
          {val:checkins.length,         label:"Check-ins",    color:"#4DC9FF"},
        ].map(s=>(
          <div key={s.label} className="big-stat-card">
            <div className="bsc-val" style={{color:s.color}}>{s.val}</div>
            <div className="bsc-label">{s.label}</div>
          </div>
        ))}
      </div>

      <ExportSection profile={profile} checkins={checkins} li={li} />

      {/* Level journey */}
      {li && (
        <div className="section-card">
          <h3 className="section-title">Level Journey</h3>
          <div className="levels-track">
            {LEVELS.map((l,i)=>{
              const reached = (profile?.xp||0)>=l.min;
              return (
                <div key={i} className={`level-step ${reached?"reached":""}`}>
                  <div className="level-dot" style={{background:reached?l.color:"#1a1a1a",border:`2px solid ${reached?l.color:"#333"}`}}>{l.emoji}</div>
                  <div className="level-step-name" style={{color:reached?l.color:"#444"}}>{l.title}</div>
                  <div className="level-step-xp" style={{color:"#555"}}>{l.min}</div>
                </div>
              );
            })}
          </div>
          <div className="level-bar-bg" style={{marginTop:12}}>
            <div className="level-bar-fill" style={{width:`${li.progress}%`,background:li.current.color}}/>
          </div>
        </div>
      )}

      <div className="charts-grid">
        {xpChart.length>1 && (
          <div className="section-card">
            <h3 className="section-title">XP Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={xpChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a"/>
                <XAxis dataKey="date" tick={{fill:"#555",fontSize:11}}/>
                <YAxis tick={{fill:"#555",fontSize:11}}/>
                <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:8}}/>
                <Line type="monotone" dataKey="xp" stroke="#FFD700" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {last14.length>1 && (
          <div className="section-card">
            <h3 className="section-title">Daily Completion % (Last 14 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a"/>
                <XAxis dataKey="date" tick={{fill:"#555",fontSize:11}}/>
                <YAxis domain={[0,100]} tick={{fill:"#555",fontSize:11}}/>
                <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:8}}/>
                <Bar dataKey="pct" fill="#FF4D4D" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {checkins.length>3 && (
          <div className="section-card">
            <h3 className="section-title">Category Balance (Last 14 Days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={catRadar}>
                <PolarGrid stroke="#222"/>
                <PolarAngleAxis dataKey="cat" tick={{fill:"#888",fontSize:11}}/>
                <Radar dataKey="value" stroke="#4DC9FF" fill="#4DC9FF" fillOpacity={0.2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
