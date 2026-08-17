// Builds the "who is this person" block that every AI feature gets — not just
// onboarding answers, but their actual tracked data: how they look (from
// physique/posture scans), what they lift, what they eat, how consistent
// they've been.
//
// Firestore reads are cached briefly: a chat conversation fires several AI
// calls in a row and re-fetching six collections per message would be both
// slow and wasteful. The TTL is short enough that a check-in or new scan
// shows up almost immediately.

import {
  getUserOnboarding, getScanHistory, getGymRecords,
  getNutritionLog, getCheckinHistory,
} from "./firebase";

const CACHE_TTL_MS = 60_000;
let cache = { uid: null, at: 0, data: null };

export function invalidateUserContext() { cache = { uid: null, at: 0, data: null }; }

async function loadRaw(uid) {
  if (cache.uid === uid && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const today = new Date().toISOString().split("T")[0];
  // Every one of these is optional context — a single failing collection
  // (permissions, empty, offline) must not blank out the whole block.
  const [onboarding, physique, posture, outfit, gym, nutrition, checkins] = await Promise.all([
    getUserOnboarding(uid).catch(() => null),
    getScanHistory(uid, "physique").catch(() => []),
    getScanHistory(uid, "posture").catch(() => []),
    getScanHistory(uid, "outfit").catch(() => []),
    getGymRecords(uid, 200).catch(() => []),
    getNutritionLog(uid, today).catch(() => []),
    getCheckinHistory(uid).catch(() => []),
  ]);

  const data = { onboarding, physique, posture, outfit, gym, nutrition, checkins };
  cache = { uid, at: Date.now(), data };
  return data;
}

// ── section builders ───────────────────────────────────────────────────────

function describeProfile(o) {
  if (!o) return null;
  const p = [];
  if (o.age)               p.push(`Age ${o.age}`);
  if (o.gender)            p.push(o.gender);
  if (o.weight)            p.push(`${o.weight} ${o.weightUnit || "lbs"}`);
  if (o.height)            p.push(`height ${o.height}`);
  if (o.sport)             p.push(`sport: ${o.sport}`);
  if (o.activityLevel)     p.push(o.activityLevel);
  if (o.exerciseFreq)      p.push(`trains ${o.exerciseFreq}x/week`);
  const line = p.length ? `- Basics: ${p.join(" · ")}` : null;

  const rest = [];
  if (o.primaryGoal)            rest.push(`- Main goal: ${o.primaryGoal}`);
  if (o.secondaryGoals?.length) rest.push(`- Also wants: ${o.secondaryGoals.join(", ")}`);
  if (o.motivation)             rest.push(`- What drives them: ${o.motivation}`);
  if (o.biggestObstacle)        rest.push(`- Biggest obstacle: ${o.biggestObstacle}`);
  if (o.struggles?.length)      rest.push(`- Struggles with: ${o.struggles.join(", ")}`);
  if (o.diet)                   rest.push(`- Diet: ${o.diet}`);
  if (o.dietaryRestrictions)    rest.push(`- Dietary restrictions: ${o.dietaryRestrictions}`);
  if (o.sleepHours)             rest.push(`- Sleep: ~${o.sleepHours}h/night`);
  if (o.confidence)             rest.push(`- Self-confidence: ${o.confidence}/10`);
  if (o.stressLevel)            rest.push(`- Stress: ${o.stressLevel}/10`);
  if (o.additionalInfo)         rest.push(`- They also told you: ${o.additionalInfo}`);

  return [line, ...rest].filter(Boolean).join("\n");
}

// "How they look" — the most recent physique/posture read, so advice can
// reference their actual build instead of generic assumptions.
function describeAppearance(physique, posture) {
  const out = [];
  const p = physique?.[0]?.result;
  if (p) {
    const bits = [];
    if (p.bodyFatEstimate)          bits.push(`est. body fat ${p.bodyFatEstimate}`);
    if (p.muscleGroups?.strong?.length)   bits.push(`strong: ${p.muscleGroups.strong.join(", ")}`);
    if (p.muscleGroups?.needWork?.length) bits.push(`needs work: ${p.muscleGroups.needWork.join(", ")}`);
    if (bits.length) out.push(`- Last physique scan: ${bits.join(" · ")}`);
    if (p.overallAssessment) out.push(`  Your previous read: "${String(p.overallAssessment).slice(0, 220)}"`);
  }
  const po = posture?.[0]?.result;
  if (po) {
    const bits = [];
    if (po.score != null)   bits.push(`posture score ${po.score}/100`);
    if (po.issues?.length)  bits.push(`issues: ${po.issues.slice(0, 3).join(", ")}`);
    if (bits.length) out.push(`- Last posture scan: ${bits.join(" · ")}`);
  }
  return out.length ? out.join("\n") : null;
}

function describeTraining(gym) {
  if (!gym?.length) return null;
  // Heaviest logged set per exercise = their working PR, which is what any
  // programming advice actually needs.
  const best = new Map();
  for (const r of gym) {
    const w = Number(r.weight) || 0;
    const cur = best.get(r.exercise);
    if (!cur || w > cur.weight) best.set(r.exercise, { weight: w, reps: r.reps, unit: r.unit || "lbs" });
  }
  const prs = [...best.entries()].slice(0, 8)
    .map(([ex, s]) => `${ex} ${s.weight}${s.unit}×${s.reps}`);
  return prs.length ? `- Best logged lifts: ${prs.join(" · ")} (${gym.length} sets logged all-time)` : null;
}

function describeNutritionToday(log) {
  if (!log?.length) return null;
  const t = log.reduce((a, i) => ({
    cal: a.cal + (Number(i.calories) || 0),
    p:   a.p   + (Number(i.protein)  || 0),
  }), { cal: 0, p: 0 });
  const meals = log.map(m => m.meal).filter(Boolean).slice(0, 6).join(", ");
  return `- Eaten today: ${t.cal} cal, ${t.p}g protein${meals ? ` (${meals})` : ""}`;
}

function describeConsistency(profile, checkins) {
  const out = [];
  if (profile) {
    out.push(`- Level ${profile.level || 1} · ${profile.xp || 0} XP · ${profile.streak || 0}-day streak (best ${profile.longestStreak || 0})`);
  }
  if (checkins?.length) {
    const recent = checkins.slice(-14);
    const pct = recent.map(c => {
      const v = Object.values(c.habits || {});
      return v.length ? Math.round((v.filter(Boolean).length / v.length) * 100) : 0;
    });
    const avg = Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
    out.push(`- Last ${recent.length} check-ins averaged ${avg}% habit completion (most recent first: ${[...pct].reverse().slice(0, 7).join("%, ")}%)`);
  }
  return out.length ? out.join("\n") : null;
}

// ── public ─────────────────────────────────────────────────────────────────

// Returns "" when there's nothing worth saying, so callers can splice it in
// unconditionally without producing an empty labelled section.
export async function buildUserContext(uid, profile) {
  if (!uid) return "";
  let raw;
  try { raw = await loadRaw(uid); } catch { return ""; }

  const sections = [
    describeProfile(raw.onboarding),
    describeAppearance(raw.physique, raw.posture),
    describeTraining(raw.gym),
    describeNutritionToday(raw.nutrition),
    describeConsistency(profile, raw.checkins),
  ].filter(Boolean);

  if (!sections.length) return "";

  return [
    "WHO YOU'RE TALKING TO (their real tracked data — use it to be specific, don't recite it back at them):",
    ...sections,
    "If something here contradicts what they say now, trust what they say now — this data can be stale.",
  ].join("\n");
}
