import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { Tent, CheckCircle2, Pencil, ClipboardList, Scale, Target, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  submitCheckIn, updateCheckIn, getTodayCheckIn,
  setExcuse, saveCustomHabits, saveCustomExcuses,
  saveWeightEntry, getWeightEntry, getWeightLog, saveWeightGoal, getUserOnboarding,
} from "../lib/firebase";
import { HABIT_CATEGORIES, EXCUSES, STREAK_MILESTONES } from "../data/gameData";
import { useToast } from "../components/Toast";
import Confetti from "../components/Confetti";
import HabitCustomizer from "../components/HabitCustomizer";

// ── Weight tracker: pure calculation helpers (kept side-effect free so they're
//    easy to unit test in isolation — see scratchpad test script) ──────────
const round1 = n => Math.round(n * 10) / 10;

// entries: array of {date:"YYYY-MM-DD", weight:Number, ...}, any order.
// Returns null when there's no history at all (brand-new user).
export function calcWeeklyAverage(entries) {
  if (!entries || entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, 7);
  const sum = recent.reduce((s, e) => s + Number(e.weight), 0);
  return round1(sum / recent.length);
}

// Shapes ascending-by-date data for the recharts trend line, capped to the
// most recent `count` entries so the sparkline stays compact.
export function calcTrendData(entries, count = 14) {
  if (!entries || entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(-count).map(e => ({ date: e.date, weight: Number(e.weight) }));
}

// direction/delta/pct progress toward a goal weight, independent of whether
// the goal is "lose" or "gain" relative to where the user started.
export function calcGoalProgress(currentWeight, goalWeight, startWeight) {
  if (currentWeight == null || goalWeight == null) return null;
  const start = startWeight != null ? startWeight : currentWeight;
  const direction = goalWeight < start ? "lose" : goalWeight > start ? "gain" : "maintain";
  const delta = round1(Math.abs(goalWeight - currentWeight));

  if (direction === "maintain") {
    return { direction, delta, pct: 100, reached: true };
  }

  const reached = direction === "lose" ? currentWeight <= goalWeight : currentWeight >= goalWeight;
  const total = Math.abs(goalWeight - start);
  const progressed = direction === "lose" ? start - currentWeight : currentWeight - start;
  const pct = total === 0 ? 100 : Math.max(0, Math.min(100, Math.round((progressed / total) * 100)));

  return { direction, delta, pct, reached };
}

function CompletionRing({ pct, size=80, stroke=7, color="var(--accent)" }) {
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

  const [habits,           setHabits]          = useState({});
  const [previousHabits,   setPreviousHabits]   = useState({});   // from today's existing checkin
  const [showExcuse,       setShowExcuse]       = useState(false);
  const [showCustomizer,   setShowCustomizer]   = useState(false);
  const [submitting,       setSubmitting]       = useState(false);
  const [result,           setResult]           = useState(null);
  const [checkedIn,        setCheckedIn]        = useState(false);
  const [confetti,         setConfetti]         = useState(false);
  const [xpBreakdown,      setXpBreakdown]      = useState(null);

  // Excuse modal state
  const [excuseText,       setExcuseText]       = useState("");
  const [excuseDays,       setExcuseDays]       = useState(2);
  const [saveAsPreset,     setSaveAsPreset]      = useState(false);

  // Weight tracker state
  const [weightLog,        setWeightLog]        = useState([]);      // recent entries, most-recent first
  const [todayWeight,      setTodayWeight]       = useState(null);    // today's saved entry, if any
  const [weightInput,      setWeightInput]       = useState("");
  const [weightUnit,       setWeightUnit]        = useState("lbs");
  const [weightSaving,     setWeightSaving]      = useState(false);
  const [weightLoaded,     setWeightLoaded]      = useState(false);
  const [showGoalEdit,     setShowGoalEdit]      = useState(false);
  const [goalInput,        setGoalInput]         = useState("");
  const [weightPromptDismissed, setWeightPromptDismissed] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const activeCategories = profile?.customHabits  || HABIT_CATEGORIES;
  const activeExcuses    = profile?.customExcuses || EXCUSES;
  const allActiveHabits  = Object.values(activeCategories).flatMap(c => c.habits);
  const total            = allActiveHabits.length;

  // On mount / profile load: if already checked in today, load previous habits
  useEffect(() => {
    if (!user || !profile) return;
    if (profile.lastCheckIn === today) {
      setCheckedIn(true);
      getTodayCheckIn(user.uid, today).then(data => {
        if (data?.habits) {
          setHabits(data.habits);
          setPreviousHabits(data.habits);
        }
      });
    }
  }, [profile?.lastCheckIn]);

  // Load weight tracker data: recent log, today's entry (if logged), and the
  // user's preferred unit (falling back to their onboarding weightUnit so we
  // don't introduce a second, inconsistent unit toggle).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [log, entry, onboarding] = await Promise.all([
          getWeightLog(user.uid, { limit: 60 }),
          getWeightEntry(user.uid, today),
          getUserOnboarding(user.uid),
        ]);
        if (cancelled) return;
        setWeightLog(log);
        setTodayWeight(entry);
        if (entry) {
          setWeightInput(String(entry.weight));
          setWeightUnit(entry.unit || "lbs");
        } else {
          setWeightUnit(onboarding?.weightUnit || "lbs");
        }
      } finally {
        if (!cancelled) setWeightLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !submitting) {
        checkedIn ? handleResubmit() : handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [checkedIn, habits, submitting]);

  // Toggle — already-submitted habits can't be unchecked
  const toggle = id => {
    if (previousHabits[id]) return;          // locked in from original submission
    setHabits(h => ({ ...h, [id]: !h[id] }));
  };

  // Count only habits that actually exist in the current active categories
  // (guards against stale IDs from old/removed habits inflating > 100%)
  const done   = allActiveHabits.filter(h => habits[h.id]).length;
  const pct    = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const catPct = cat => {
    if (!cat.habits.length) return 0;
    const d = cat.habits.filter(x => habits[x.id]).length;
    return Math.round((d / cat.habits.length) * 100);
  };

  // XP preview: for first checkin = all checked; for update = only newly checked
  const newlyCheckedIds = Object.keys(habits).filter(id => habits[id] && !previousHabits[id]);
  const liveXP = checkedIn
    ? allActiveHabits.filter(h => newlyCheckedIds.includes(h.id)).reduce((s, h) => s + h.xp, 0)
    : allActiveHabits.reduce((s, h) => s + (habits[h.id] ? h.xp : 0), 0);

  // ── First-time check-in ────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting || checkedIn) return;
    setSubmitting(true);
    try {
      const r = await submitCheckIn(user.uid, habits, today, activeCategories);
      setResult(r);
      setCheckedIn(true);
      setPreviousHabits({ ...habits });
      await refreshProfile();

      const breakdown = Object.values(activeCategories).flatMap(c =>
        c.habits.filter(h => habits[h.id]).map(h => ({ label:h.label, xp:h.xp, cat:c.label, color:c.color }))
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

  // ── Re-check-in (add more habits later in the day) ─────────────────────
  async function handleResubmit() {
    if (submitting || newlyCheckedIds.length === 0) return;
    setSubmitting(true);
    try {
      const r = await updateCheckIn(user.uid, habits, previousHabits, today, activeCategories);
      if (r.noChange) { toast("No new habits to add.", "info"); return; }

      setPreviousHabits({ ...habits });
      setResult(prev => prev
        ? { ...prev, xpGained: prev.xpGained + r.xpGained, newXP: r.newXP, newLevel: r.newLevel, levelUp: r.levelUp }
        : { xpGained: r.xpGained, newXP: r.newXP, newLevel: r.newLevel, levelUp: r.levelUp, newStreak: profile?.streak || 0, streakBonus: 0 }
      );
      await refreshProfile();

      if (r.levelUp) {
        setConfetti(true);
        toast(`🎖️ Level Up! You're now Level ${r.newLevel}`, "levelup", 5000);
      } else {
        toast(`+${r.xpGained} XP added for ${newlyCheckedIds.length} new habit${newlyCheckedIds.length > 1 ? "s" : ""}! 💪`, "xp");
      }
    } catch (e) {
      toast("Something went wrong. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Excuse ─────────────────────────────────────────────────────────────
  async function handleExcuseSubmit() {
    if (!excuseText.trim()) { toast("Enter a reason", "warning"); return; }
    const days = Math.max(1, Math.min(30, Number(excuseDays) || 1));
    await setExcuse(user.uid, excuseText.trim(), days);

    if (saveAsPreset) {
      const newPreset = { id: `exc_${Date.now()}`, label: excuseText.trim(), icon: "📌", days };
      const existing  = profile?.customExcuses || EXCUSES;
      const next = [newPreset, ...existing.filter(e => e.label !== excuseText.trim())].slice(0, 8);
      await saveCustomExcuses(user.uid, next);
    }

    await refreshProfile();
    setShowExcuse(false);
    setExcuseText("");
    setExcuseDays(2);
    setSaveAsPreset(false);
    toast(`Excuse set: "${excuseText.trim()}" (${days}d) — streak protected ✅`, "success");
  }

  function openExcuseModal() {
    setExcuseText("");
    setExcuseDays(2);
    setSaveAsPreset(false);
    setShowExcuse(true);
  }

  // ── Customizer save ────────────────────────────────────────────────────
  async function handleSaveCustomHabits(cats) {
    await saveCustomHabits(user.uid, cats);
    await refreshProfile();
    toast("Habits updated ✅", "success");
  }
  async function handleSaveCustomExcuses(excs) {
    await saveCustomExcuses(user.uid, excs);
    await refreshProfile();
  }

  // ── Weight tracker ─────────────────────────────────────────────────────
  async function handleLogWeight() {
    const val = Number(weightInput);
    if (!val || val <= 0) { toast("Enter a valid weight", "warning"); return; }
    setWeightSaving(true);
    try {
      const entry = { weight: val, unit: weightUnit, date: today };
      await saveWeightEntry(user.uid, entry);
      setTodayWeight(entry);
      setWeightLog(prev => [entry, ...prev.filter(e => e.date !== today)]);
      setWeightPromptDismissed(true);
      toast(todayWeight ? "Weight updated ✅" : "Weight logged ✅", "success");
    } catch (e) {
      toast("Something went wrong. Try again.", "error");
    } finally {
      setWeightSaving(false);
    }
  }

  function openGoalEdit() {
    setGoalInput(profile?.weightGoal ? String(profile.weightGoal) : "");
    setShowGoalEdit(true);
  }

  async function handleSaveGoal() {
    const val = Number(goalInput);
    if (!val || val <= 0) { toast("Enter a valid target weight", "warning"); return; }
    try {
      await saveWeightGoal(user.uid, val, weightUnit);
      await refreshProfile();
      setShowGoalEdit(false);
      toast("Goal updated ✅", "success");
    } catch (e) {
      toast("Something went wrong. Try again.", "error");
    }
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  // Derived weight-tracker values
  const weeklyAvg   = useMemo(() => calcWeeklyAverage(weightLog), [weightLog]);
  const trendData   = useMemo(() => calcTrendData(weightLog), [weightLog]);
  const sortedLog    = useMemo(() => [...weightLog].sort((a,b) => a.date.localeCompare(b.date)), [weightLog]);
  const currentWeight = todayWeight?.weight ?? sortedLog[sortedLog.length-1]?.weight ?? null;
  const startWeight   = sortedLog[0]?.weight ?? currentWeight;
  const goalProgress  = useMemo(
    () => calcGoalProgress(currentWeight, profile?.weightGoal ?? null, startWeight),
    [currentWeight, profile?.weightGoal, startWeight]
  );
  const showWeightPrompt = weightLoaded && !todayWeight && !weightPromptDismissed;

  // ── Render ─────────────────────────────────────────────────────────────
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
            <div className="excuse-chip" style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
              <Tent size={14}/> Excuse active until {profile.excuseActive.until}
            </div>
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
            <CompletionRing pct={pct} size={108} stroke={10} color="var(--accent)"/>
            <div className="ring-center">
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--accent)", lineHeight:1 }}>{pct}%</div>
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

      {/* Daily weight-log reminder — dismissible, client-side "have you logged
          today?" nudge. No push infra required. */}
      {showWeightPrompt && (
        <div className="wt-reminder-banner">
          <Scale size={14}/>
          <span>Haven't logged today's weight yet — keep the trend going.</span>
          <button onClick={() => setWeightPromptDismissed(true)} aria-label="Dismiss"><X size={14}/></button>
        </div>
      )}

      {/* Weight tracker widget */}
      <div className="wt-widget">
        <div className="wt-header">
          <span className="wt-title"><Scale size={15}/> Weight Tracker</span>
          {weeklyAvg != null && <span className="wt-avg-chip">{weeklyAvg} {weightUnit} avg · 7d</span>}
        </div>

        <div className="wt-body">
          <div className="wt-log-row">
            <input
              className="wt-input"
              type="number" step="0.1" min="0"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              placeholder={`Weight (${weightUnit})`}
              onKeyDown={e => e.key === "Enter" && handleLogWeight()}
            />
            <select className="wt-unit-select" value={weightUnit} onChange={e => setWeightUnit(e.target.value)}>
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
            <button className="btn-primary wt-log-btn" onClick={handleLogWeight} disabled={weightSaving || !weightInput}>
              {weightSaving ? "Saving…" : todayWeight ? "Update" : "Log Weight"}
            </button>
          </div>

          {todayWeight && (
            <div className="wt-logged-note"><CheckCircle2 size={12}/> Logged today: {todayWeight.weight} {todayWeight.unit}</div>
          )}

          {trendData.length > 1 && (
            <div className="wt-trend">
              <ResponsiveContainer width="100%" height={64}>
                <LineChart data={trendData} margin={{ top:4, right:6, bottom:0, left:6 }}>
                  <Tooltip
                    contentStyle={{ background:"#111", border:"1px solid #333", borderRadius:8, fontSize:12 }}
                    labelStyle={{ color:"#888" }}
                    formatter={(v) => [`${v} ${weightUnit}`, "Weight"]}
                  />
                  <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {weightLoaded && trendData.length <= 1 && (
            <div className="wt-empty-trend">Log a few days in a row to see your trend line.</div>
          )}

          {/* Goal progress */}
          {profile?.weightGoal ? (
            <div className="wt-goal-block">
              {goalProgress && (
                <>
                  <div className="wt-goal-bar-bg"><div className="wt-goal-bar-fill" style={{ width:`${goalProgress.pct}%` }}/></div>
                  <div className="wt-goal-label">
                    {goalProgress.reached
                      ? "Goal reached! 🎯"
                      : `${goalProgress.delta} ${weightUnit} to ${goalProgress.direction === "lose" ? "lose" : "gain"} · goal ${profile.weightGoal} ${profile.weightGoalUnit || weightUnit}`}
                  </div>
                </>
              )}
              <button className="wt-goal-edit-btn" onClick={openGoalEdit}><Target size={12}/> Edit Goal</button>
            </div>
          ) : (
            <button className="wt-goal-edit-btn wt-set-goal-btn" onClick={openGoalEdit}><Target size={12}/> Set a Goal Weight</button>
          )}

          {showGoalEdit && (
            <div className="wt-goal-edit-form">
              <input
                className="wt-input"
                type="number" step="0.1" min="0"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder={`Target weight (${weightUnit})`}
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSaveGoal()}
              />
              <button className="btn-primary wt-log-btn" onClick={handleSaveGoal} disabled={!goalInput}>Save</button>
              <button className="btn-secondary" onClick={() => setShowGoalEdit(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* XP result card */}
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
                <span style={{ color:item.color, fontSize:11 }}>{item.cat}</span>
                <span style={{ flex:1, fontSize:13 }}>{item.label}</span>
                <span style={{ color:"var(--accent)", fontFamily:"monospace", fontSize:12 }}>+{item.xp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Habit grid — shown always (update mode when already checked in) */}
      <>
        <div className="habits-section-header">
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span className="habits-section-title">Today's Habits</span>
            {checkedIn && (
              <span style={{ fontSize:11, color:"#00FF88", display:"inline-flex", alignItems:"center", gap:5 }}>
                <CheckCircle2 size={13}/> Checked in · tick more boxes to add XP
              </span>
            )}
          </div>
          <button className="btn-customize-habits" onClick={() => setShowCustomizer(true)} style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
            <Pencil size={13}/> Customize
          </button>
        </div>

        {total === 0 ? (
          <div className="cust-empty-state">
            <div style={{ marginBottom:12, display:"flex", justifyContent:"center" }}><ClipboardList size={40}/></div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>No habits set up yet</div>
            <div style={{ fontSize:13, color:"#555", marginBottom:16 }}>Add your own habits and categories to start tracking</div>
            <button className="btn-primary" onClick={() => setShowCustomizer(true)} style={{ width:"auto", padding:"10px 24px" }}>
              + Set Up My Habits
            </button>
          </div>
        ) : (
          <div className="habits-grid">
            {Object.entries(activeCategories).map(([k, cat]) => (
              <div key={k} className="habit-card">
                <div className="habit-card-header" style={{ borderColor:cat.color }}>
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
                  <div style={{ padding:"10px 12px", fontSize:12, color:"#444", fontStyle:"italic" }}>
                    No habits — click ✏️ Customize to add some
                  </div>
                ) : cat.habits.map(h => {
                  const locked = !!previousHabits[h.id];
                  return (
                    <label key={h.id}
                      className={`habit-row ${habits[h.id] ? "checked" : ""} ${locked ? "habit-locked" : ""}`}
                      title={locked ? "Already counted in today's check-in" : undefined}
                    >
                      <input type="checkbox" checked={!!habits[h.id]} onChange={() => toggle(h.id)} disabled={locked}/>
                      <span className="habit-label">{h.label}</span>
                      <span className="habit-xp">
                        {locked ? "✓" : `+${h.xp}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {total > 0 && (
          <div className="checkin-bar">
            <div className="checkin-summary">
              {checkedIn ? (
                <>
                  <span style={{ color:"#888" }}>{newlyCheckedIds.length} new</span>
                  &nbsp;·&nbsp;
                  <span style={{ color:"var(--accent)", fontFamily:"monospace" }}>+{liveXP} XP</span>
                </>
              ) : (
                <>
                  <span style={{ color:"#888" }}>{done}/{total} habits</span>
                  &nbsp;·&nbsp;
                  <span style={{ color:"var(--accent)", fontFamily:"monospace" }}>+{liveXP} XP</span>
                  {(profile?.streak||0) >= 7 && <span style={{ color:"#FF9800", marginLeft:8, fontSize:12 }}>+streak bonus</span>}
                </>
              )}
            </div>
            <div className="checkin-btns">
              <button className="btn-excuse-sm" onClick={openExcuseModal} style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Tent size={14}/> Set Excuse</button>
              {checkedIn ? (
                <button className="btn-primary" onClick={handleResubmit}
                  disabled={submitting || newlyCheckedIds.length === 0}
                  style={{ width:"auto", padding:"10px 32px" }}>
                  {submitting ? "Saving…" : `Update Check-In (+${liveXP} XP)`}
                </button>
              ) : (
                <button className="btn-primary" onClick={handleSubmit}
                  disabled={submitting || done === 0}
                  style={{ width:"auto", padding:"10px 32px" }}>
                  {submitting ? "Submitting…" : "Submit Check-In"}
                </button>
              )}
            </div>
          </div>
        )}
      </>

      {/* Excuse modal — text input + quick-picks */}
      {showExcuse && (
        <div className="modal-overlay" onClick={() => setShowExcuse(false)}>
          <div className="modal excuse-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display:"flex", alignItems:"center", gap:8 }}><Tent size={20}/> Set an Excuse</h3>
            <p style={{ fontSize:13, color:"#666", marginBottom:16 }}>
              Your streak stays protected for the duration you set.
            </p>

            {/* Quick-pick chips from saved presets */}
            {activeExcuses.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>
                  Saved presets
                </div>
                <div className="excuse-chip-row">
                  {activeExcuses.map(ex => (
                    <button key={ex.id} className="excuse-quick-chip"
                      onClick={() => { setExcuseText(ex.label); setExcuseDays(ex.days); }}>
                      <span>{ex.icon}</span>
                      <span>{ex.label}</span>
                      <span style={{ color:"#555", fontSize:10 }}>{ex.days}d</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text input */}
            <label className="excuse-field-label">What's going on?</label>
            <input
              className="excuse-text-input"
              value={excuseText}
              onChange={e => setExcuseText(e.target.value)}
              placeholder="e.g. Camping trip, sick day, visiting family…"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleExcuseSubmit()}
            />

            {/* Days picker */}
            <label className="excuse-field-label" style={{ marginTop:10 }}>Days protected</label>
            <div className="excuse-days-row">
              {[1,2,3,5,7,14].map(d => (
                <button key={d}
                  className={`excuse-day-btn ${excuseDays === d ? "active" : ""}`}
                  onClick={() => setExcuseDays(d)}>
                  {d}d
                </button>
              ))}
              <input
                className="excuse-days-custom"
                type="number" min={1} max={30}
                value={excuseDays}
                onChange={e => setExcuseDays(Math.max(1, Math.min(30, Number(e.target.value))))}
                title="Custom days"
              />
            </div>

            {/* Save as preset */}
            <label className="excuse-save-label">
              <input type="checkbox" checked={saveAsPreset} onChange={e => setSaveAsPreset(e.target.checked)}/>
              Save as quick-pick preset (up to 8)
            </label>

            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button className="btn-primary" onClick={handleExcuseSubmit}
                disabled={!excuseText.trim()}
                style={{ flex:1, padding:"11px" }}>
                Protect Streak
              </button>
              <button className="btn-secondary" onClick={() => setShowExcuse(false)}
                style={{ padding:"11px 20px" }}>
                Cancel
              </button>
            </div>
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
