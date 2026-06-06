import { useAuth } from "../hooks/useAuth";
import { getLevelInfo, HABIT_CATEGORIES } from "../data/gameData";
import { useState, useEffect } from "react";

// Mini widget preview components
function StreakWidget({ streak, level, levelTitle, accentColor="#FFD700" }) {
  return (
    <div className="widget-preview" style={{ background:"#111", borderRadius:16, padding:"16px 20px", width:160, height:80, display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ fontSize:32 }}>🔥</div>
      <div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:accentColor, lineHeight:1 }}>{streak}</div>
        <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", letterSpacing:.5 }}>Day Streak</div>
      </div>
    </div>
  );
}

function XPWidget({ xp, level, progress, color="#FFD700" }) {
  return (
    <div className="widget-preview" style={{ background:"#111", borderRadius:16, padding:16, width:160, height:80 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color }}>Level {level}</span>
        <span style={{ fontSize:11, color:"#888" }}>{xp} XP</span>
      </div>
      <div style={{ height:6, background:"#222", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${progress}%`, background:color, borderRadius:3 }}/>
      </div>
    </div>
  );
}

function TodayWidget({ pct, done, total }) {
  const r = 28, circ = 2*Math.PI*r;
  return (
    <div className="widget-preview" style={{ background:"#111", borderRadius:16, padding:16, width:160, height:80, display:"flex", gap:14, alignItems:"center" }}>
      <svg width={64} height={64} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="#222" strokeWidth={6}/>
        <circle cx={32} cy={32} r={r} fill="none" stroke="#FFD700" strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round"/>
      </svg>
      <div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:"#FFD700", lineHeight:1 }}>{pct}%</div>
        <div style={{ fontSize:10, color:"#888" }}>{done}/{total} habits</div>
      </div>
    </div>
  );
}

function LargeWidget({ streak, xp, level, levelTitle, pct, color="#FFD700" }) {
  return (
    <div className="widget-preview" style={{ background:"#111", borderRadius:20, padding:20, width:340, height:160 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color, letterSpacing:2 }}>GRIND</div>
          <div style={{ fontSize:12, color:color }}>{levelTitle}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color, lineHeight:1 }}>🔥 {streak}</div>
          <div style={{ fontSize:10, color:"#888" }}>day streak</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:16, fontSize:13, color:"#888", marginBottom:10 }}>
        <span>⚡ {xp} XP</span>
        <span>·</span>
        <span>Today: {pct}%</span>
        <span>·</span>
        <span>Lv {level}</span>
      </div>
      <div style={{ height:5, background:"#222", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3 }}/>
      </div>
    </div>
  );
}

export default function Widgets() {
  const { profile } = useAuth();
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Listen for PWA install prompt — must be useEffect, not useState
  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  const li     = profile ? getLevelInfo(profile.xp||0) : null;
  const streak = profile?.streak||0;
  const xp     = profile?.xp||0;
  const level  = profile?.level||1;
  const activeCategories = profile?.customHabits || HABIT_CATEGORIES;
  const total  = Object.values(activeCategories).flatMap(c=>c.habits).length;
  const today  = new Date().toISOString().split("T")[0];
  const pct    = 0; // Would be today's progress, shown as 0 for preview

  const isMobile = /iPhone|Android|iPad/.test(navigator.userAgent);

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">📱 Home Screen</h1><p className="page-sub">Install GRIND and add widgets to your home screen</p></div>
      </div>

      {/* PWA install section */}
      <div className="section-card" style={{ marginBottom:20 }}>
        <h3 className="section-title">Install App</h3>
        {installed ? (
          <div className="success-banner">✅ GRIND is installed on your device!</div>
        ) : (
          <>
            <p style={{ fontSize:14, color:"#888", marginBottom:16, lineHeight:1.6 }}>
              Install GRIND as an app on your phone or desktop. Works offline, loads instantly, and unlocks home screen widgets.
            </p>
            <div className="install-steps">
              {isMobile && /iPhone|iPad/.test(navigator.userAgent) ? (
                <>
                  <div className="install-step"><span className="step-num">1</span><span>Tap the <strong>Share</strong> button in Safari (box with arrow)</span></div>
                  <div className="install-step"><span className="step-num">2</span><span>Scroll down and tap <strong>"Add to Home Screen"</strong></span></div>
                  <div className="install-step"><span className="step-num">3</span><span>Tap <strong>Add</strong> — GRIND will appear on your home screen</span></div>
                </>
              ) : isMobile ? (
                <>
                  <div className="install-step"><span className="step-num">1</span><span>Tap the <strong>menu (⋮)</strong> in Chrome</span></div>
                  <div className="install-step"><span className="step-num">2</span><span>Tap <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></span></div>
                  <div className="install-step"><span className="step-num">3</span><span>Confirm — the GRIND icon will appear</span></div>
                </>
              ) : (
                <>
                  <div className="install-step"><span className="step-num">1</span><span>Click the <strong>install icon (⊕)</strong> in your browser's address bar</span></div>
                  <div className="install-step"><span className="step-num">2</span><span>Click <strong>Install</strong></span></div>
                  <div className="install-step"><span className="step-num">3</span><span>GRIND opens as a standalone app</span></div>
                </>
              )}
            </div>
            {deferredPrompt && (
              <button className="btn-primary" onClick={installPWA} style={{ width:"auto", padding:"10px 32px", marginTop:12 }}>
                ⊕ Install GRIND Now
              </button>
            )}
          </>
        )}
      </div>

      {/* Widget previews */}
      <div className="section-card">
        <h3 className="section-title">Widget Previews</h3>
        <p style={{ fontSize:13, color:"#888", marginBottom:20 }}>
          These show what your home screen widgets look like. Actual iOS/Android widgets require a native app — the PWA version displays a compact version when added to home screen.
        </p>

        <h4 style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>Small Widgets (2×2)</h4>
        <div className="widget-grid">
          <div className="widget-item">
            <StreakWidget streak={streak} level={level} levelTitle={li?.current.title}/>
            <div className="widget-label">Streak Counter</div>
          </div>
          <div className="widget-item">
            <XPWidget xp={xp} level={level} progress={li?.progress||0}/>
            <div className="widget-label">XP & Level</div>
          </div>
          <div className="widget-item">
            <TodayWidget pct={pct} done={0} total={total}/>
            <div className="widget-label">Today's Progress</div>
          </div>
        </div>

        <h4 style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:.5, margin:"24px 0 12px" }}>Large Widget (4×2)</h4>
        <div className="widget-item">
          <LargeWidget streak={streak} xp={xp} level={level} levelTitle={li?.current.title||"—"} pct={pct}/>
          <div className="widget-label">GRIND Dashboard</div>
        </div>
      </div>

      {/* PWA features list */}
      <div className="section-card">
        <h3 className="section-title">PWA Features</h3>
        <div className="pwa-features">
          {[
            ["⚡","Instant Load","Cached for offline access"],
            ["📱","Home Screen Icon","Looks and feels like a native app"],
            ["🔔","Push Notifications","Streak reminders (when enabled)"],
            ["📴","Offline Mode","Check in even without internet"],
            ["🔄","Auto Updates","Always on the latest version"],
          ].map(([icon,title,sub])=>(
            <div key={title} className="pwa-feature">
              <span style={{ fontSize:24 }}>{icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{title}</div>
                <div style={{ fontSize:12, color:"#888" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
