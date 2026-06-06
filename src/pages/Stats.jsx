import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { getLevelInfo, LEVELS, HABIT_CATEGORIES } from "../data/gameData";

export default function Stats() {
  const { user, profile } = useAuth();
  const [checkins, setCheckins] = useState([]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"users",user.uid,"checkins"),orderBy("timestamp","asc")))
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
