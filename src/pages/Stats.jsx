import { useEffect, useMemo, useState } from "react";
import {
  Upload, Download, FileText, Brain, Sparkles, Lightbulb,
  TrendingUp, TrendingDown, Minus, Flame, Trophy, Target,
  CalendarDays, Star, Activity,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { db, getGymRecords, getNutritionLog, getScanHistory } from "../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
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

// ── Deeper stats: period aggregation, 9-axis radar, consistency heatmap ─────
// Pure functions only (no React/Firestore) so the date-bucketing and scoring
// math can be sanity-checked in isolation. Verified against a throwaway Node
// test harness with fake check-in arrays before wiring into the UI.

function parseLocalDate(dateStr) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function fmtKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun..6=Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); // back to Monday
  return d;
}
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function startOfYear(date)  { return new Date(date.getFullYear(), 0, 1); }

function periodLabel(start, granularity) {
  if (granularity === "year")  return String(start.getFullYear());
  if (granularity === "month") return start.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  if (granularity === "all")   return "All-time";
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${start.toLocaleDateString(undefined, { month: "short" })} ${start.getDate()} – ${sameMonth ? "" : end.toLocaleDateString(undefined, { month: "short" }) + " "}${end.getDate()}`;
}

function clamp(n, lo, hi) { return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; }

function longestConsecutiveStreak(dateStrs) {
  if (!dateStrs.length) return 0;
  const sorted = [...new Set(dateStrs)].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((parseLocalDate(sorted[i]) - parseLocalDate(sorted[i - 1])) / 86400000);
    if (diffDays === 1) { cur++; best = Math.max(best, cur); }
    else if (diffDays > 1) { cur = 1; }
  }
  return best;
}

/** Buckets check-ins into week/month/year/all-time periods with computed metrics. */
function aggregatePeriods(checkins, granularity, categories) {
  if (!checkins.length) return [];
  const bucketFn = granularity === "week" ? startOfWeek
    : granularity === "month" ? startOfMonth
    : granularity === "year" ? startOfYear
    : () => new Date(1970, 0, 1);

  const buckets = new Map();
  for (const c of checkins) {
    const start = bucketFn(parseLocalDate(c.date));
    const key = fmtKey(start);
    if (!buckets.has(key)) buckets.set(key, { start, checkins: [] });
    buckets.get(key).checkins.push(c);
  }

  return [...buckets.values()].sort((a, b) => a.start - b.start).map(({ start, checkins: cks }) => {
    const stats = cks.map(c => ({ c, ...checkinStats(c) }));
    const totalXP = cks.reduce((s, c) => s + (c.xpGained || 0), 0);
    const avgPct  = stats.length ? Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length) : 0;
    let best = null, worst = null;
    for (const s of stats) {
      if (!best  || s.pct > best.pct)  best  = s;
      if (!worst || s.pct < worst.pct) worst = s;
    }
    const categoryBreakdown = Object.entries(categories || {}).map(([, cat]) => {
      let total = 0, done = 0;
      cks.forEach(c => { cat.habits.forEach(h => { total++; if (c.habits?.[h.id]) done++; }); });
      return { label: cat.label, value: total ? Math.round((done / total) * 100) : 0 };
    });
    return {
      key: fmtKey(start), start, label: periodLabel(start, granularity),
      count: cks.length, totalXP, avgPct,
      bestDay:  best  ? { date: best.c.date,  pct: best.pct }  : null,
      worstDay: worst ? { date: worst.c.date, pct: worst.pct } : null,
      longestStreak: longestConsecutiveStreak(cks.map(c => c.date)),
      categoryBreakdown,
    };
  });
}

/** Compares the two most recent periods; null if there aren't two yet. */
function compareLatestPeriods(periods) {
  if (periods.length < 2) return null;
  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  return {
    current, previous,
    deltaXP:  current.totalXP - previous.totalXP,
    deltaPct: current.avgPct  - previous.avgPct,
    deltaCount: current.count - previous.count,
  };
}

/**
 * Builds the 9-point engagement radar: the user's habit categories (4 by
 * default) plus 5 normalized engagement dimensions, all on a shared 0-100
 * scale so they plot meaningfully against each other:
 *  - Consistency    — % of the last 30 days with a check-in logged
 *  - Streak Power   — current streak, normalized against a 30-day target
 *  - Personal Best  — longest streak ever, normalized against a 60-day target
 *  - XP Growth      — total XP, log-scaled against the GOAT level threshold (10,000 XP)
 *  - Cross-Training — workouts + nutrition logs + AI scans used in the last 7 days
 * This tells a fuller story than raw habit-completion alone without padding
 * the chart with fabricated zero-value axes.
 */
function computeRadarDimensions({ checkins, categories, profile, gymRecords, nutritionLog, scanHistory }) {
  const categoryAxes = Object.entries(categories || {}).map(([, cat]) => {
    let total = 0, done = 0;
    checkins.slice(-14).forEach(c => { cat.habits.forEach(h => { total++; if (c.habits?.[h.id]) done++; }); });
    return { axis: cat.label, value: total ? Math.round((done / total) * 100) : 0 };
  });

  const today = new Date();
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const last30 = daysAgo(30), last7 = daysAgo(7);

  const consistency = clamp(Math.round((checkins.filter(c => parseLocalDate(c.date) >= last30).length / 30) * 100), 0, 100);
  const streakPower  = clamp(Math.round(((profile?.streak || 0) / 30) * 100), 0, 100);
  const personalBest = clamp(Math.round(((profile?.longestStreak || 0) / 60) * 100), 0, 100);
  const xp = profile?.xp || 0;
  const xpGrowth = clamp(Math.round((Math.log10(xp + 1) / Math.log10(10000)) * 100), 0, 100);

  const toDate = (ts) => (ts?.toDate ? ts.toDate() : null);
  const nutritionDays = new Set(
    (nutritionLog || []).filter(e => { const t = toDate(e.timestamp); return t && t >= last7; }).map(e => e.date || "")
  ).size;
  const workoutDays = new Set(
    (gymRecords || []).filter(r => { const t = toDate(r.createdAt); return t && t >= last7; }).map(r => toDate(r.createdAt).toDateString())
  ).size;
  const scansThisWeek = (scanHistory || []).filter(s => { const t = toDate(s.timestamp); return t && t >= last7; }).length;
  const crossTraining = clamp(Math.round((nutritionDays / 7) * 40 + (workoutDays / 7) * 40 + (Math.min(scansThisWeek, 7) / 7) * 20), 0, 100);

  return [
    ...categoryAxes,
    { axis: "Consistency", value: consistency },
    { axis: "Streak Power", value: streakPower },
    { axis: "Personal Best", value: personalBest },
    { axis: "XP Growth", value: xpGrowth },
    { axis: "Cross-Training", value: crossTraining },
  ];
}

/** GitHub-contributions-style grid: `weeksBack` columns of 7 days each, ending this week. */
function buildHeatmapWeeks(checkins, weeksBack = 18) {
  const pctByDate = new Map();
  checkins.forEach(c => pctByDate.set(c.date, checkinStats(c).pct));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const gridEnd = startOfWeek(today); gridEnd.setDate(gridEnd.getDate() + 6);
  const gridStart = new Date(gridEnd); gridStart.setDate(gridStart.getDate() - (weeksBack * 7 - 1));
  const startMonday = startOfWeek(gridStart);

  const weeks = [];
  let cursor = new Date(startMonday);
  while (cursor <= gridEnd) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor); d.setDate(d.getDate() + i);
      const key = fmtKey(d);
      const future = d > today;
      // pct: null = future (not yet happened), -1 = past day with no check-in logged, 0-100 = logged completion
      days.push({ date: key, pct: future ? null : (pctByDate.has(key) ? pctByDate.get(key) : -1), future });
    }
    weeks.push(days);
    cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function heatmapColor(pct) {
  if (pct === null) return "transparent";
  if (pct < 0) return "var(--bg3)";
  if (pct === 0) return "var(--bg4)";
  if (pct < 34) return "color-mix(in srgb, var(--accent) 30%, var(--bg3))";
  if (pct < 67) return "color-mix(in srgb, var(--accent) 60%, var(--bg3))";
  return "var(--accent)";
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
      <h3 className="section-title" style={{ display:"flex", alignItems:"center", gap:6 }}><Upload size={14}/> Export & AI Insights</h3>
      <p style={{ fontSize:13, color:"var(--muted2)", marginBottom:16, lineHeight:1.5 }}>
        Download your progress as a spreadsheet or polished report — or have the AI dig through
        your check-in history for real patterns and honest feedback.
      </p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <button className="btn-secondary" onClick={() => exportCSV(checkins)} disabled={!checkins.length} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
          <Download size={14}/> Export CSV
        </button>
        <button className="btn-secondary" onClick={handlePDF} disabled={building || !checkins.length} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
          {building ? "Building…" : <><FileText size={14}/> Export PDF Report</>}
        </button>
        <button className="btn-primary" onClick={handleInsights} disabled={thinking || checkins.length < 3} style={{ width:"auto", padding:"10px 20px", display:"inline-flex", alignItems:"center", gap:6 }}>
          {thinking ? <><Brain size={14}/> Thinking…</> : <><Sparkles size={14}/> Generate AI Insights</>}
        </button>
      </div>
      {checkins.length < 3 && <p style={{ fontSize:12, color:"var(--muted)", marginTop:10 }}>Log a few more check-ins to unlock AI insights.</p>}
      {insights?.length > 0 && (
        <div className="ai-insights-list">
          {insights.map((ins, i) => <div key={i} className="ai-insight-item" style={{ display:"flex", alignItems:"flex-start", gap:6 }}><Lightbulb size={14} style={{ flexShrink:0, marginTop:2 }}/> {ins}</div>)}
        </div>
      )}
    </div>
  );
}

// ── Custom chart tooltips (dark-themed, replacing recharts' default white box) ─
function ChartTooltip({ active, label, rows }) {
  if (!active || !rows?.length) return null;
  return (
    <div className="stats-tooltip">
      <div className="stats-tooltip-label">{label}</div>
      {rows.map((r, i) => (
        <div key={i} className="stats-tooltip-row">
          {r.color && <span className="stats-tooltip-dot" style={{ background: r.color }} />}
          <span className="stats-tooltip-key">{r.key}</span>
          <span className="stats-tooltip-val">{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function DailyBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const rows = [{ key: "Completion", val: `${d.pct}%`, color: d.pct >= 90 ? "var(--green)" : d.pct >= 50 ? "var(--accent)" : "var(--muted2)" }];
  if (typeof d.done === "number") rows.push({ key: "Habits done", val: `${d.done}/${d.total}` });
  if (typeof d.xpGained === "number") rows.push({ key: "XP gained", val: `+${d.xpGained}` });
  return <ChartTooltip active={active} label={label} rows={rows} />;
}

function PeriodTrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return <ChartTooltip active={active} label={label} rows={[
    { key: "Avg completion", val: `${d.avgPct}%`, color: "var(--accent)" },
    { key: "XP earned", val: d.totalXP },
    { key: "Check-ins", val: d.count },
  ]} />;
}

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return <ChartTooltip active={active} label={d.axis} rows={[{ key: "Score", val: `${d.value}/100`, color: "var(--accent)" }]} />;
}

// ── Improved daily-completion bar chart: per-bar coloring + real hover state ─
function DailyCompletionChart({ data }) {
  const [activeIdx, setActiveIdx] = useState(null);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} onMouseLeave={() => setActiveIdx(null)}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} />
        <Tooltip content={<DailyBarTooltip />} cursor={{ fill: "var(--bg3)", opacity: 0.35 }} />
        <Bar dataKey="pct" radius={[4, 4, 0, 0]} animationDuration={700} animationEasing="ease-out"
             onMouseEnter={(_, idx) => setActiveIdx(idx)}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.pct >= 90 ? "var(--green)" : d.pct >= 50 ? "var(--accent)" : "var(--muted2)"}
              opacity={activeIdx === null || activeIdx === i ? 1 : 0.4}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Period selector + week/month/year/all-time breakdown ────────────────────
const PERIOD_OPTIONS = [
  { id: "week",  label: "Week" },
  { id: "month", label: "Month" },
  { id: "year",  label: "Year" },
  { id: "all",   label: "All-time" },
];

function PeriodBreakdown({ checkins, categories }) {
  const [granularity, setGranularity] = useState("week");
  const periods = useMemo(() => aggregatePeriods(checkins, granularity, categories), [checkins, granularity, categories]);
  const latest  = periods.length ? periods[periods.length - 1] : null;
  const cmp     = useMemo(() => compareLatestPeriods(periods), [periods]);
  const trend   = periods.slice(-8);

  if (!checkins.length) return null;

  return (
    <div className="section-card">
      <div className="stats-period-header">
        <h3 className="section-title" style={{ marginBottom: 0 }}>Period Breakdown</h3>
        <div className="stats-period-tabs">
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.id}
              className={`stats-period-tab ${granularity === o.id ? "active" : ""}`}
              onClick={() => setGranularity(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <>
          <div className="stats-period-label">{latest.label}</div>
          <div className="stats-period-metrics">
            <div className="spm-item"><span className="spm-val">{latest.totalXP}</span><span className="spm-lbl">XP earned</span></div>
            <div className="spm-item"><span className="spm-val">{latest.avgPct}%</span><span className="spm-lbl">Avg completion</span></div>
            <div className="spm-item"><span className="spm-val">{latest.longestStreak}</span><span className="spm-lbl">Longest streak</span></div>
            <div className="spm-item"><span className="spm-val">{latest.count}</span><span className="spm-lbl">Check-ins</span></div>
          </div>

          {cmp && (
            <div className="stats-period-compare">
              {[
                { label: `vs prior ${granularity}`, sub: "XP", delta: cmp.deltaXP, suffix: "" },
                { label: `vs prior ${granularity}`, sub: "Completion", delta: cmp.deltaPct, suffix: "%" },
                { label: `vs prior ${granularity}`, sub: "Check-ins", delta: cmp.deltaCount, suffix: "" },
              ].map(({ label, sub, delta, suffix }) => {
                const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                const cls  = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
                return (
                  <div key={sub} className="stats-compare-item">
                    <Icon size={14} className={`stats-compare-icon ${cls}`} />
                    <div>
                      <div className={`stats-compare-delta ${cls}`}>{delta > 0 ? "+" : ""}{delta}{suffix}</div>
                      <div className="stats-compare-sub">{sub} {label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(latest.bestDay || latest.worstDay) && (
            <div className="stats-period-days">
              {latest.bestDay && (
                <div className="spd-item best"><Star size={13} /> Best day: {latest.bestDay.date} · {latest.bestDay.pct}%</div>
              )}
              {latest.worstDay && latest.worstDay.date !== latest.bestDay?.date && (
                <div className="spd-item worst"><Target size={13} /> Toughest day: {latest.worstDay.date} · {latest.worstDay.pct}%</div>
              )}
            </div>
          )}

          {latest.categoryBreakdown.length > 0 && (
            <div className="stats-cat-breakdown">
              {latest.categoryBreakdown.map(cb => (
                <div key={cb.label} className="scb-row">
                  <span className="scb-label">{cb.label}</span>
                  <div className="scb-bar-bg"><div className="scb-bar-fill" style={{ width: `${cb.value}%` }} /></div>
                  <span className="scb-val">{cb.value}%</span>
                </div>
              ))}
            </div>
          )}

          {trend.length > 1 && (
            <div className="stats-period-trend">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 10 }} width={28} />
                  <Tooltip content={<PeriodTrendTooltip />} cursor={{ fill: "var(--bg3)", opacity: 0.35 }} />
                  <Bar dataKey="avgPct" radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out">
                    {trend.map((p, i) => (
                      <Cell key={p.key} fill={i === trend.length - 1 ? "var(--accent)" : "var(--bg4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── GitHub-contributions-style consistency heatmap ───────────────────────────
function ConsistencyHeatmap({ checkins }) {
  const weeks = useMemo(() => buildHeatmapWeeks(checkins, 18), [checkins]);
  if (!checkins.length) return null;

  return (
    <div className="section-card">
      <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarDays size={14} /> Consistency — Last {weeks.length} Weeks
      </h3>
      <div className="stats-heatmap-scroll">
        <div className="stats-heatmap-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="stats-heatmap-col">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="stats-heatmap-cell"
                  title={day.future ? undefined : `${day.date}: ${day.pct < 0 ? "no check-in" : day.pct + "% complete"}`}
                  style={{ background: heatmapColor(day.pct) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="stats-heatmap-legend">
        <span>Less</span>
        <span className="stats-heatmap-cell" style={{ background: "var(--bg3)" }} />
        <span className="stats-heatmap-cell" style={{ background: "var(--bg4)" }} />
        <span className="stats-heatmap-cell" style={{ background: "color-mix(in srgb, var(--accent) 30%, var(--bg3))" }} />
        <span className="stats-heatmap-cell" style={{ background: "color-mix(in srgb, var(--accent) 60%, var(--bg3))" }} />
        <span className="stats-heatmap-cell" style={{ background: "var(--accent)" }} />
        <span>More</span>
      </div>
    </div>
  );
}

// ── Personal-record callouts ─────────────────────────────────────────────────
function PersonalRecords({ checkins, profile }) {
  const records = useMemo(() => {
    if (!checkins.length) return null;
    let bestDay = null, mostXPDay = null;
    checkins.forEach(c => {
      const { pct } = checkinStats(c);
      if (!bestDay || pct > bestDay.pct) bestDay = { date: c.date, pct };
      const xp = c.xpGained || 0;
      if (!mostXPDay || xp > mostXPDay.xp) mostXPDay = { date: c.date, xp };
    });
    return { bestDay, mostXPDay, totalDaysLogged: checkins.length };
  }, [checkins]);

  if (!records) return null;

  return (
    <div className="section-card">
      <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Trophy size={14} /> Personal Records
      </h3>
      <div className="stats-records-row">
        <div className="stats-record-card">
          <Star size={18} className="stats-record-icon" />
          <div className="stats-record-val">{records.bestDay.pct}%</div>
          <div className="stats-record-lbl">Best day · {records.bestDay.date}</div>
        </div>
        <div className="stats-record-card">
          <Sparkles size={18} className="stats-record-icon" />
          <div className="stats-record-val">+{records.mostXPDay.xp}</div>
          <div className="stats-record-lbl">Biggest XP day · {records.mostXPDay.date}</div>
        </div>
        <div className="stats-record-card">
          <Flame size={18} className="stats-record-icon" />
          <div className="stats-record-val">{profile?.longestStreak || 0}</div>
          <div className="stats-record-lbl">Longest streak ever</div>
        </div>
        <div className="stats-record-card">
          <Activity size={18} className="stats-record-icon" />
          <div className="stats-record-val">{records.totalDaysLogged}</div>
          <div className="stats-record-lbl">Total days logged</div>
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const { user, profile } = useAuth();
  const [checkins, setCheckins] = useState([]);
  const [gymRecords, setGymRecords] = useState([]);
  const [nutritionLog, setNutritionLog] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"grind_users",user.uid,"checkins"),orderBy("timestamp","asc")))
      .then(s=>setCheckins(s.docs.map(d=>({date:d.id,...d.data()}))));
    // Lightweight, capped reads — feeds the 9-axis engagement radar only, not the whole page.
    getGymRecords(user.uid, 100).then(setGymRecords).catch(()=>{});
    getNutritionLog(user.uid).then(setNutritionLog).catch(()=>{});
    getScanHistory(user.uid).then(setScanHistory).catch(()=>{});
  },[user]);

  const li = profile ? getLevelInfo(profile.xp||0) : null;

  let cumXP = 0;
  const xpChart = checkins.map(c=>{ cumXP+=(c.xpGained||0); return {date:c.date.slice(5),xp:cumXP}; });
  const last14 = checkins.slice(-14).map(c=>{
    const { done, total, pct } = checkinStats(c);
    return { date:c.date.slice(5), pct, done, total, xpGained:c.xpGained||0 };
  });

  // Uses user's custom habits if set, else defaults
  const activeCategories = profile?.customHabits || HABIT_CATEGORIES;

  // 9-point engagement radar: 4 category-completion axes + 5 normalized
  // engagement dimensions (consistency, streaks, XP growth, cross-training).
  const radarData = useMemo(() => computeRadarDimensions({
    checkins, categories: activeCategories, profile, gymRecords, nutritionLog, scanHistory,
  }), [checkins, activeCategories, profile, gymRecords, nutritionLog, scanHistory]);

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
          {val:profile?.xp||0,         label:"Total XP",     color:"#D4A017"},
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

      <PeriodBreakdown checkins={checkins} categories={activeCategories} />

      <PersonalRecords checkins={checkins} profile={profile} />

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
                <Line type="monotone" dataKey="xp" stroke="var(--accent)" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {last14.length>1 && (
          <div className="section-card">
            <h3 className="section-title">Daily Completion % (Last 14 Days)</h3>
            <DailyCompletionChart data={last14} />
          </div>
        )}
        {checkins.length>3 && (
          <div className="section-card">
            <h3 className="section-title">Engagement Radar — 9 Points</h3>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#222"/>
                <PolarAngleAxis dataKey="axis" tick={{fill:"#888",fontSize:10}}/>
                <Tooltip content={<RadarTooltip/>}/>
                <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={2}
                       animationDuration={700} animationEasing="ease-out"/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <ConsistencyHeatmap checkins={checkins} />
    </div>
  );
}
