import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { submitCheckIn, setExcuse, saveCustomHabits, saveCustomExcuses } from "../lib/firebase";
import { HABIT_CATEGORIES, EXCUSES, STREAK_MILESTONES } from "../data/gameData";
import { useToast } from "../components/Toast";
import Confetti from "../components/Confetti";
import HabitCustomizer from "../components/HabitCustomizer";

function CompletionRing({ pct, size=80, stroke=7, color="#FFD700" }) {
  const r = (size - stroke*2) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1a1a1a" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round"
        style={{ transition:"stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)" }}/>
    </svg>
  );
}

export default function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();

  const [habits,          setHabits]         = useState({});
  const [showExcuse,      setShowExcuse]      = useState(false);
  const [showCustomizer,  setShowCustomizer]  = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [result,          setResult]          = useState(null);
  const [checkedIn,       setCheckedIn]       = useState(false);
  const [confetti,        setConfetti]        = useState(false);
  const [xpBreakdown,     setXpBreakdown]     = useState(null);

  const today = new Date().toISOString().split("T")[0];

  // Use user's custom habits if saved, otherwise fall back to generic defaults
  const activeCategories = profile?.customHabits || HABIT_CATEGORIES;
  const activeExcuses    = profile?.customExcuses || EXCUSES;
  const allActiveHabits  = Object.values(activeCategories).flatMap(c => c.habits);
  const total            = allActiveHabits.length;

  useEffect(() => {
    if (profile?.lastCheckIn === today) setCheckedIn(true);
  }, [profile]);

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !checkedIn && done > 0) {
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [checkedIn, habits]);

  const toggle = id => setHabits(h => ({ ...h, [id]: !h[id] }));
  const done   = Object.values(habits).filter(Boolean).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const catPct = cat => {
    const h = cat.habits, d = h.filter(x => habits[x.id]).length;
    return h.length > 0 ? Math.round((d / h.length) * 100) : 0;
  };

  // Live XP preview using per-habit values
  const liveXP = allActiveHabits.reduce((acc, h) => acc + (habits[h.id] ? h.xp : 0), 0);

  async function handleSubmit() {
    if (submitting || checkedIn) return;
    setSubmitting(true);
    try {
      const r = await submitCheckIn(user.uid, habits, today, activeCategories);
      setResult(r);
      setCheckedIn(true);
      await refreshProfile();

      const breakdown = Object.values(activeCategories).flatMap(c =>
        c.habits.filter(h => habits[h.id]).map(h => ({ label: h.label, xp: h.xp, cat: c.label, color: c.color }))
      );
      setXpBreakdown(breakdown);

      if (r.levelUp) {
        setConfetti(true);
        toast(`🎖️ Level Up! You're now Level ${r.newLevel}`, "levelup", 5000);
      } else if (STREAK_MILESTONES.includes(r.newStreak)) {
        setConfetti(true);
        toast(`🔥 ${r.newStreak}-day streak! You're locked in.`, "streak", 5000);
      } else {
        toast(`+${r.xpGained} XP earned! Streak: ${r.newStreak} 🔥`, "xp");
      }
    } catch (e) {
      toast("Something went wrong. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExcuse(ex) {
    await setExcuse(user.uid, ex.label, ex.days);
    await refreshProfile();
    setShowExcuse(false);
    toast(`Excuse set: ${ex.label} (${ex.days}d). Streak protected ✅`, "success");
  }

  async function handleSaveCustomHabits(cats) {
    await saveCustomHabits(user.uid, cats);
    await refreshProfile();
    toast("Habits updated ✅", "success");
  }

  async function handleSaveCustomExcuses(excs) {
    await saveCustomExcuses(user.uid, excs);
    await refreshProfile();
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="page-content">
      <Confetti active={confetti} onDone={() => setConfetti(false)}/>

      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting()}, {user?.displayName?.split(" ")[0]} 👋</h1>
          <p className="page-sub">{new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {profile?.excuseActive && (
            <div className="excuse-chip">⛺ Excuse active until {profile.excuseActive.until}</div>
          )}
          {!checkedIn && (
            <div className="keyboard-hint">Ctrl+Enter to submit</div>
          )}
        </div>
      </div>

      {/* Completion rings */}
      <div className="rings-row">
        <div className="ring-card">
          <div className="ring-wrap">
            <CompletionRing pct={pct} size={108} stroke={10} color="#FFD700"/>
            <div className="ring-center">
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"#FFD700", lineHeight:1 }}>{pct}%</div>
              <div style={{ fontSize:9, color:"#555", letterSpacing:1 }}>TODAY</div>
            </div>
          </div>
          <div className="ring-label">Overall</div>
        </div>
        {Object.entries(activeCategories).map(([k, cat]) => (
          <div key={k} className="ring-card">
            <div className="ring-wrap">
              <CompletionRing pct={catPct(cat)} size={76} stroke={7} color={cat.color}/>
              <div className="ring-center" style={{ fontSize:20 }}>{cat.icon}</div>
            </div>
            <div className="ring-label" style={{ color: catPct(cat)===100 ? cat.color : undefined }}>
              {cat.label} {catPct(cat)===100 && "✓"}
            </div>
          </div>
        ))}
      </div>

      {/* Already checked in */}
      {checkedIn && !result && (
        <div className="success-banner">✅ Already checked in today — come back tomorrow and keep the streak alive!</div>
      )}

      {/* Result summary */}
      {result && xpBreakdown && (
        <div className="result-card">
          <div style={{ display:"flex", alignItems:"baseline", gap:12, justifyContent:"center", marginBottom:8 }}>
            <div className="result-xp">+{result.xpGained} XP</div>
            {result.streakBonus > 0 && <div style={{ color:"#FF9800", fontSize:14 }}>incl. +{result.streakBonus} streak bonus</div>}
          </div>
          <div className="result-meta">🔥 {result.newStreak} day streak &nbsp;·&nbsp; Level {result.newLevel} {result.levelUp && "🎖️ LEVEL UP!"}</div>
          <div className="xp-breakdown">
            {xpBreakdown.map((item, i) => (
              <div key={i} className="xp-breakdown-row">
                <span style={{ color: item.color, fontSize:11 }}>{item.cat}</span>
                <span style={{ flex:1, fontSize:13 }}>{item.label}</span>
                <span style={{ color:"#FFD700", fontFamily:"monospace", fontSize:12 }}>+{item.xp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Habit grid */}
      {!checkedIn && (
        <>
          {/* Section header with customize button */}
          <div className="habits-section-header">
            <span className="habits-section-title">Today's Habits</span>
            <button
              className="btn-customize-habits"
              onClick={() => setShowCustomizer(true)}
              title="Add, edit, or remove habit categories and habits"
            >
              ✏️ Customize
            </button>
          </div>

          {total === 0 ? (
            <div className="cust-empty-state">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No habits set up yet</div>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Add your own habits and categories to start tracking</div>
              <button className="btn-primary" onClick={() => setShowCustomizer(true)} style={{ width: "auto", padding: "10px 24px" }}>
                + Set Up My Habits
              </button>
            </div>
          ) : (
            <div className="habits-grid">
              {Object.entries(activeCategories).map(([k, cat]) => (
                <div key={k} className="habit-card">
                  <div className="habit-card-header" style={{ borderColor: cat.color }}>
                    <span>{cat.icon}</span>
                    <span style={{ color:cat.color, fontWeight:700, fontSize:13, textTransform:"uppercase", letterSpacing:1 }}>{cat.label}</span>
                    <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
                      <div className="cat-mini-ring">
                        <CompletionRing pct={catPct(cat)} size={22} stroke={3} color={cat.color}/>
                      </div>
                      <span style={{ fontSize:12, color:"#555" }}>{cat.habits.filter(h=>habits[h.id]).length}/{cat.habits.length}</span>
                    </div>
                  </div>
                  {cat.habits.length === 0 ? (
                    <div style={{ padding: "10px 12px", fontSize: 12, color: "#444", fontStyle: "italic" }}>
                      No habits — click ✏️ Customize to add some
                    </div>
                  ) : cat.habits.map(h => (
                    <label key={h.id} className={`habit-row ${habits[h.id] ? "checked" : ""}`}>
                      <input type="checkbox" checked={!!habits[h.id]} onChange={() => toggle(h.id)}/>
                      <span className="habit-label">{h.label}</span>
                      <span className="habit-xp">+{h.xp}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="checkin-bar">
            <div className="checkin-summary">
              <span style={{ color:"#888" }}>{done}/{total} habits</span>
              &nbsp;·&nbsp;
              <span style={{ color:"#FFD700", fontFamily:"monospace" }}>+{liveXP} XP</span>
              {(profile?.streak||0) >= 7 && <span style={{ color:"#FF9800", marginLeft:8, fontSize:12 }}>+streak bonus</span>}
            </div>
            <div className="checkin-btns">
              <button className="btn-excuse-sm" onClick={() => setShowExcuse(true)}>Set Excuse ⛺</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting || done===0}
                style={{ width:"auto", padding:"10px 32px" }}>
                {submitting ? "Submitting…" : "Submit Check-In"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Excuse modal */}
      {showExcuse && (
        <div className="modal-overlay" onClick={() => setShowExcuse(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Set an Excuse</h3>
            <p>Your streak stays protected for the duration.</p>
            <div className="excuse-grid">
              {activeExcuses.map(ex => (
                <button key={ex.id} className="excuse-card" onClick={() => handleExcuse(ex)}>
                  <span style={{ fontSize:28 }}>{ex.icon}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{ex.label}</span>
                  <span style={{ fontSize:11, color:"#666" }}>{ex.days} day{ex.days>1?"s":""}</span>
                </button>
              ))}
              {activeExcuses.length === 0 && (
                <div style={{ gridColumn:"1/-1", color:"#555", fontSize:13, padding:12 }}>
                  No excuses set up. <button className="link-btn" onClick={() => { setShowExcuse(false); setShowCustomizer(true); }}>Add some →</button>
                </div>
              )}
            </div>
            <button className="btn-secondary" onClick={() => setShowExcuse(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Habit customizer modal */}
      {showCustomizer && (
        <HabitCustomizer
          categories={activeCategories}
          excuses={activeExcuses}
          onSaveCategories={handleSaveCustomHabits}
          onSaveExcuses={handleSaveCustomExcuses}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );
}
