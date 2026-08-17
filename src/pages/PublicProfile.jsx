import { useState, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { getPublicProfile } from "../lib/firebase";
import { getLevelInfo } from "../data/gameData";
import QRCode from "qrcode";

export default function PublicProfile({ uid, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const shareRef = useRef();

  useEffect(() => {
    if (!uid) return;
    getPublicProfile(uid).then(p => { setProfile(p); setLoading(false); });
  }, [uid]);

  useEffect(() => {
    if (!profile || !shareRef.current) return;
    const url = `${window.location.origin}${window.location.pathname}?profile=${uid}`;
    QRCode.toCanvas(shareRef.current, url, { width:120, margin:1, color:{ dark:"#FF3131", light:"#111" }});
  }, [profile]);

  if (loading) return <div className="page-content"><div className="loading-card"><div className="spinner"/></div></div>;
  if (!profile) return <div className="page-content"><p style={{ color:"#888" }}>Profile not found.</p></div>;

  const li = getLevelInfo(profile.xp||0);

  return (
    <div className="page-content">
      {onBack && <button className="btn-secondary" onClick={onBack} style={{ marginBottom:20 }}>← Back</button>}

      <div className="pub-profile-header">
        <div className="pub-avatar-wrap">
          {profile.photoURL
            ? <img src={profile.photoURL} className="pub-avatar" referrerPolicy="no-referrer" alt=""/>
            : <div className="pub-avatar placeholder">{profile.displayName?.[0]}</div>
          }
          <div className="pub-level-badge" style={{ background:li.current.color, color:"#000" }}>
            Lv {profile.level||1}
          </div>
        </div>
        <div className="pub-info">
          <h1 className="pub-name">{profile.displayName}</h1>
          <div className="pub-title" style={{ color:li.current.color }}>{li.current.emoji} {li.current.title}</div>
          <div className="pub-stats-row">
            <div className="pub-stat"><span style={{ color:"var(--accent)" }}>{profile.xp||0}</span><span>XP</span></div>
            <div className="pub-stat"><span style={{ color:"#FF4D4D", display:"inline-flex", alignItems:"center", gap:3 }}><Flame size={13}/> {profile.streak||0}</span><span>streak</span></div>
            <div className="pub-stat"><span style={{ color:"#FF9800" }}>{profile.longestStreak||0}</span><span>best streak</span></div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
          <canvas ref={shareRef} className="pub-qr"/>
          <span style={{ fontSize:10, color:"#555" }}>Share profile</span>
        </div>
      </div>

      {/* Level progress */}
      <div className="section-card" style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:13 }}>
          <span style={{ color:li.current.color }}>{li.current.title}</span>
          {li.next && <span style={{ color:"#555" }}>→ {li.next.title}</span>}
        </div>
        <div className="level-bar-bg">
          <div className="level-bar-fill" style={{ width:`${li.progress}%`, background:li.current.color }}/>
        </div>
      </div>

      {/* Skills */}
      {profile.skills?.length > 0 && (
        <div className="section-card">
          <h3 className="section-title">Skills</h3>
          <div className="pub-skills">
            {profile.skills.sort((a,b)=>(b.xp||0)-(a.xp||0)).map(skill => (
              <div key={skill.id} className="pub-skill-chip">
                <span style={{ fontSize:20 }}>{skill.icon}</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{skill.name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>Lv {skill.level||1} · {Math.round((skill.totalMinutes||0)/60)}h</div>
                </div>
                <div style={{ marginLeft:"auto", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"var(--accent)" }}>
                  {skill.xp||0} XP
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
