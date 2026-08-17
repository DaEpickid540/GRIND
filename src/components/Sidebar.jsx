import {
  Zap, ClipboardList, BarChart3, Dumbbell, Salad, Camera, Target, Wind, Mic,
  Users, GraduationCap, Trophy, Store as StoreIcon, Smartphone, BookOpen,
  X, Settings as SettingsIcon, Coins, Flame, AlertTriangle,
} from "lucide-react";
import { logout } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { getEffectiveLevelInfo } from "../data/gameData";
import { getAIConfig, PROVIDERS } from "../lib/aiProvider";
import { getItemById } from "../data/storeItems";

const NAV_SECTIONS = [
  { label:"Main", items: [
    { id:"dashboard", icon:Zap,            label:"Today"       },
    { id:"plan",      icon:ClipboardList,  label:"Weekly Plan" },
    { id:"stats",     icon:BarChart3,      label:"Stats"       },
  ]},
  { label:"Train", items: [
    { id:"gym",       icon:Dumbbell, label:"Gym Records" },
    { id:"nutrition", icon:Salad,    label:"Nutrition"   },
    { id:"ai_scan",   icon:Camera,   label:"AI Scans"    },
    { id:"voice_coach", icon:Mic,    label:"Voice Coach" },
    { id:"skills",    icon:Target,   label:"Skills"      },
    { id:"breathing", icon:Wind,     label:"Breathing"   },
  ]},
  { label:"Social", items: [
    { id:"friends",     icon:Users,          label:"Friends"     },
    { id:"classes",     icon:GraduationCap,  label:"Classes"     },
    { id:"leaderboard", icon:Trophy,         label:"Leaderboard" },
  ]},
  { label:"More", items: [
    { id:"store",    icon:StoreIcon, label:"Store"       },
    { id:"widgets",  icon:Smartphone,label:"Home Screen" },
    { id:"tutorial", icon:BookOpen,  label:"Setup Guide" },
  ]},
];

export default function Sidebar({ page, setPage, onOpenSettings, isOpen, onClose }) {
  const { user, profile } = useAuth();
  // Effective (gated/decay-capped) level, not just raw XP — this is the one
  // spot that's always on screen, so it's the app's most-seen statement of
  // "what rank are you," and that should be the honest, earned one.
  const li    = profile ? getEffectiveLevelInfo(profile) : null;
  const aiCfg = getAIConfig();
  const prov  = aiCfg ? PROVIDERS[aiCfg.provider] : null;

  const today = new Date().toISOString().split("T")[0];
  const todayCheckedIn = profile?.lastCheckIn === today;
  const streakAtRisk = (() => {
    if (!profile?.lastCheckIn || !profile?.streak) return false;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    return profile.lastCheckIn!==yesterday.toISOString().split("T")[0] && profile.lastCheckIn!==today && !profile.excuseActive;
  })();

  // Equipped cosmetics
  const equipped   = profile?.equippedItems || {};
  const equippedBadge  = equipped.badge  ? getItemById(equipped.badge)  : null;
  const equippedFrame  = equipped.frame  ? getItemById(equipped.frame)  : null;
  const equippedTitle  = equipped.title  ? getItemById(equipped.title)  : null;
  const equippedStreak = equipped.streak ? getItemById(equipped.streak) : null;
  const streakIcon     = equippedStreak ? equippedStreak.display : (streakAtRisk ? "⚠️" : "🔥");

  const coins = profile?.coins ?? 0;

  return (
    <aside className={`sidebar${isOpen ? " open" : ""}`}>
      <div className="sidebar-logo">
        <Zap className="logo-bolt" size={24} strokeWidth={2.5}/>
        <span className="logo-text">GRIND</span>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu"><X size={18}/></button>
      </div>

      {user && (
        <div className="sidebar-user">
          <div className={`sidebar-avatar-wrap${equippedFrame ? ` frame-${equippedFrame.display}` : ""}`}>
            {user.photoURL
              ? <img src={user.photoURL} className="sidebar-avatar" referrerPolicy="no-referrer" alt=""/>
              : <div className="sidebar-avatar placeholder">?</div>}
            {equippedBadge && (
              <span className="sidebar-avatar-badge">{equippedBadge.display}</span>
            )}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-name">{user.displayName?.split(" ")[0]}</div>
            {equippedTitle && (
              <div className="sidebar-equipped-title">[{equippedTitle.display}]</div>
            )}
            {li && <div className="sidebar-level" style={{ color:li.current.color }}>{li.current.emoji} {li.current.title}</div>}
          </div>
        </div>
      )}

      {li && (
        <div className="sidebar-xp">
          {/* Always the brand accent, not the level color — level 1's color is
              #888 gray, which made the bar invisible against the dark sidebar. */}
          <div className="sidebar-xp-bar"><div className="sidebar-xp-fill" style={{ width:`${li.progress}%`, background:"var(--accent)" }}/></div>
          <div className="sidebar-xp-label">{profile?.xp||0} XP {li.next?`→ ${li.next.min}`:"(MAX)"}</div>
        </div>
      )}

      {/* Coins + streak — compact side-by-side stat chips */}
      {(profile || profile?.streak > 0) && (
        <div className="sidebar-stats-row">
          {profile && (
            <div className="sidebar-coins" onClick={() => setPage("store")} title={`${coins.toLocaleString()} coins — go to Store`}>
              <Coins className="sidebar-coins-icon" size={14}/>
              <span className="sidebar-coins-count">{coins.toLocaleString()}</span>
              <span className="sidebar-coins-arrow">→</span>
            </div>
          )}
          {profile?.streak > 0 && (
            <div className={`sidebar-streak ${streakAtRisk?"at-risk":""}`}
                 title={streakAtRisk ? "Streak at risk — check in today!" : `${profile.streak} day streak`}>
              <span className="streak-fire">{streakIcon}</span>
              <span className="streak-num" style={{ color:streakAtRisk?"#FF9800":"#FF4D4D" }}>{profile.streak}</span>
            </div>
          )}
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(sec => (
          <div key={sec.label} className="nav-section">
            <div className="nav-section-label">{sec.label}</div>
            {sec.items.map(n => (
              <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={() => setPage(n.id)}>
                <n.icon className="nav-icon" size={17} strokeWidth={2}/>
                <span className="nav-label">{n.label}</span>
                {n.id==="dashboard" && !todayCheckedIn && profile?.streak > 0 && <span className="nav-dot"/>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {prov ? (
        <div className="sidebar-ai-chip" onClick={onOpenSettings} title="Change AI provider">
          <img src={prov.icon} alt="" className="prov-logo-sm"/>
          <span style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prov.name}</span>
          <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"#00FF88", flexShrink:0 }}/>
        </div>
      ) : (
        <button className="sidebar-ai-chip no-key" onClick={onOpenSettings}>
          <AlertTriangle size={14}/><span style={{ fontSize:11, color:"#FF9800" }}>No AI key set</span>
        </button>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-footer-stats"><span>Lv {profile?.level||1}</span><span>·</span><span>{profile?.xp||0} XP</span></div>
        <div style={{ display:"flex", gap:6 }}>
          <button className="sidebar-settings-btn" onClick={onOpenSettings} title="Settings (⌘,)"><SettingsIcon size={16}/></button>
          <button className="sidebar-logout" onClick={logout}>Sign Out</button>
        </div>
      </div>
    </aside>
  );
}
