import { logout } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { getLevelInfo } from "../data/gameData";
import { getAIConfig, PROVIDERS } from "../lib/aiProvider";
import { getItemById } from "../data/storeItems";

const NAV = [
  { id:"dashboard",   icon:"⚡", label:"Today"        },
  { id:"plan",        icon:"📋", label:"Weekly Plan"  },
  { id:"skills",      icon:"🎯", label:"Skills"       },
  { id:"gym",         icon:"🏋️", label:"Gym Records"  },
  { id:"nutrition",   icon:"🥗", label:"Nutrition"    },
  { id:"ai_scan",     icon:"📸", label:"AI Scans"     },
  { id:"breathing",   icon:"🌬️", label:"Breathing"    },
  { id:"friends",     icon:"👥", label:"Friends"      },
  { id:"classes",     icon:"🎓", label:"Classes"      },
  { id:"leaderboard", icon:"🏆", label:"Leaderboard"  },
  { id:"store",       icon:"🏪", label:"Store"        },
  { id:"widgets",     icon:"📱", label:"Home Screen"  },
  { id:"stats",       icon:"📊", label:"Stats"        },
  { id:"tutorial",    icon:"📖", label:"Setup Guide"  },
];

export default function Sidebar({ page, setPage, onOpenSettings, isOpen, onClose }) {
  const { user, profile } = useAuth();
  const li    = profile ? getLevelInfo(profile.xp||0) : null;
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
        <span className="logo-bolt">⚡</span>
        <span className="logo-text">GRIND</span>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">✕</button>
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
          <div className="sidebar-xp-bar"><div className="sidebar-xp-fill" style={{ width:`${li.progress}%`, background:li.current.color }}/></div>
          <div className="sidebar-xp-label">{profile?.xp||0} XP {li.next?`→ ${li.next.min}`:"(MAX)"}</div>
        </div>
      )}

      {/* Coin balance */}
      {profile && (
        <div className="sidebar-coins" onClick={() => setPage("store")} title="Go to Store">
          <span className="sidebar-coins-icon">🪙</span>
          <span className="sidebar-coins-count">{coins.toLocaleString()}</span>
          <span className="sidebar-coins-label">coins</span>
          <span className="sidebar-coins-arrow">→</span>
        </div>
      )}

      {profile?.streak > 0 && (
        <div className={`sidebar-streak ${streakAtRisk?"at-risk":""}`}>
          <span className="streak-fire">{streakIcon}</span>
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <span className="streak-num" style={{ color:streakAtRisk?"#FF9800":"#FF4D4D" }}>{profile.streak}</span>
              <span className="streak-label">day streak</span>
            </div>
            {streakAtRisk && <div style={{ fontSize:10, color:"#FF9800", marginTop:1 }}>Check in today!</div>}
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={() => setPage(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
            {n.id==="dashboard" && !todayCheckedIn && profile?.streak > 0 && <span className="nav-dot"/>}
          </button>
        ))}
      </nav>

      {prov ? (
        <div className="sidebar-ai-chip" onClick={onOpenSettings} title="Change AI provider">
          <span style={{ color:prov.color }}>{prov.icon}</span>
          <span style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{prov.name}</span>
          <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"#00FF88", flexShrink:0 }}/>
        </div>
      ) : (
        <button className="sidebar-ai-chip no-key" onClick={onOpenSettings}>
          <span>⚠️</span><span style={{ fontSize:11, color:"#FF9800" }}>No AI key set</span>
        </button>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-footer-stats"><span>Lv {profile?.level||1}</span><span>·</span><span>{profile?.xp||0} XP</span></div>
        <div style={{ display:"flex", gap:6 }}>
          <button className="sidebar-settings-btn" onClick={onOpenSettings} title="Settings (⌘,)">⚙️</button>
          <button className="sidebar-logout" onClick={logout}>Sign Out</button>
        </div>
      </div>
    </aside>
  );
}
