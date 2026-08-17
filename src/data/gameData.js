// src/data/gameData.js
// These are generic starter defaults. Users can fully customize via the
// Customize Habits button on the dashboard — changes are saved to Firestore.

export const HABIT_CATEGORIES = {
  fitness: {
    label: "Fitness",
    icon: "💪",
    color: "#FF4D4D",
    habits: [
      { id: "exercised",  label: "Worked out / exercised",        xp: 15 },
      { id: "steps",      label: "Hit daily movement goal",       xp:  8 },
      { id: "stretch",    label: "Stretched / mobility work",     xp:  5 },
    ],
  },
  health: {
    label: "Health",
    icon: "🥗",
    color: "#4DC9FF",
    habits: [
      { id: "ate_well",   label: "Ate well / clean nutrition",    xp: 10 },
      { id: "sleep",      label: "Got enough sleep (7–9 hrs)",    xp: 10 },
      { id: "water",      label: "Drank enough water",            xp:  5 },
      { id: "hygiene",    label: "Hygiene routine done",          xp:  5 },
    ],
  },
  productivity: {
    label: "Productivity",
    icon: "📋",
    color: "#D4A017",
    habits: [
      { id: "deep_work",   label: "Did focused deep work",        xp: 15 },
      { id: "tasks_done",  label: "Completed main tasks",         xp: 10 },
      { id: "organized",   label: "Stayed organized / planned",   xp:  5 },
    ],
  },
  mindset: {
    label: "Mindset",
    icon: "🧠",
    color: "#FF88FF",
    habits: [
      { id: "no_doom",      label: "No doom scrolling (1hr+ free)", xp: 10 },
      { id: "positive",     label: "Practiced positive self-talk",  xp:  8 },
      { id: "comfort_zone", label: "Did something challenging",     xp: 15 },
      { id: "outside",      label: "Went outside / got fresh air",  xp:  5 },
    ],
  },
};

export const ALL_HABITS = Object.values(HABIT_CATEGORIES).flatMap(c => c.habits);

export const EXCUSES = [
  { id: "sick",      label: "Sick Day",         icon: "🤒", days: 2 },
  { id: "travel",    label: "Traveling",         icon: "✈️", days: 3 },
  { id: "vacation",  label: "Vacation",          icon: "🏖️", days: 7 },
  { id: "family",    label: "Family Event",      icon: "🏠", days: 2 },
  { id: "emergency", label: "Emergency",         icon: "🚨", days: 2 },
  { id: "event",     label: "Special Event",     icon: "🎉", days: 1 },
  { id: "rest_day",  label: "Rest / Recovery",   icon: "🛌", days: 1 },
];

// Tiers 1-8 are the original "Journey" ladder — left byte-for-byte identical
// (min/title/color/emoji) since existing UI + users are already attached to
// them. Tiers 9-20 extend the ladder upward with a much steeper XP curve, and
// some of the upper tiers also carry `minDaysSinceSignup` / `minRecentCheckins`
// gates — see getEffectiveLevelInfo() below for how those are enforced.
// getLevelInfo() (raw XP -> tier) intentionally ignores those gate fields
// entirely, so it keeps behaving exactly as before for every existing caller.
export const LEVELS = [
  { min: 0,     num: 1,  title: "Couch Potato",    color: "#888",    emoji: "🥔" },
  { min: 200,   num: 2,  title: "Getting Started", color: "#4CAF50", emoji: "🌱" },
  { min: 500,   num: 3,  title: "Consistent",      color: "#2196F3", emoji: "💧" },
  { min: 1000,  num: 4,  title: "Grinder",         color: "#9C27B0", emoji: "⚙️" },
  { min: 2000,  num: 5,  title: "Locked In",       color: "#FF9800", emoji: "🔒" },
  { min: 4000,  num: 6,  title: "Varsity Ready",   color: "#F44336", emoji: "🏅" },
  { min: 7000,  num: 7,  title: "Elite",           color: "#D4A017", emoji: "⭐" },
  { min: 10000, num: 8,  title: "GOAT",            color: "#FF4081", emoji: "🐐" },
  // --- new tiers below: XP curve steepens hard, upper tiers also gate on
  // account age and/or recent check-in frequency, not just lifetime XP ---
  { min: 14000,  num: 9,  title: "Built Different",  color: "#00BCD4", emoji: "🦾" },
  { min: 20000,  num: 10, title: "No Days Off",      color: "#3F51B5", emoji: "🔥",
    minDaysSinceSignup: 60 },
  { min: 28000,  num: 11, title: "Certified Menace", color: "#009688", emoji: "😤",
    minDaysSinceSignup: 90, minRecentCheckins: 20 },
  { min: 40000,  num: 12, title: "Main Character",   color: "#8D6E63", emoji: "🎬",
    minDaysSinceSignup: 120 },
  { min: 55000,  num: 13, title: "Different Breed",  color: "#8BC34A", emoji: "🐺",
    minDaysSinceSignup: 150, minRecentCheckins: 22 },
  { min: 75000,  num: 14, title: "Untouchable",      color: "#00E5FF", emoji: "🛡️",
    minDaysSinceSignup: 180 },
  { min: 100000, num: 15, title: "Legend Status",    color: "#FFD700", emoji: "🏆",
    minDaysSinceSignup: 210, minRecentCheckins: 24 },
  { min: 135000, num: 16, title: "Mythic",           color: "#B026FF", emoji: "🐉",
    minDaysSinceSignup: 270 },
  { min: 180000, num: 17, title: "Titan",            color: "#1DE9B6", emoji: "⚡",
    minDaysSinceSignup: 330, minRecentCheckins: 25 },
  { min: 240000, num: 18, title: "Immortal",         color: "#E0E0E0", emoji: "👑",
    minDaysSinceSignup: 365 },
  { min: 320000, num: 19, title: "Living Legend",    color: "#7DF9FF", emoji: "🌟",
    minDaysSinceSignup: 450, minRecentCheckins: 26 },
  { min: 420000, num: 20, title: "Final Boss",       color: "#FF3131", emoji: "🔴",
    minDaysSinceSignup: 540, minRecentCheckins: 27 },
];

// Pure, XP-only lookup — UNCHANGED behavior. Called synchronously all over the
// app (Sidebar, Dashboard, Skills, Widgets, Stats, PublicProfile) as
// getLevelInfo(profile.xp||0). Deliberately does NOT know about time-since-
// signup, check-in frequency, or inactivity decay — those live only in
// getEffectiveLevelInfo() below so this function's contract never changes.
export function getLevelInfo(xp) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const progress = next ? ((xp - current.min) / (next.min - current.min)) * 100 : 100;
  return { current, next, progress };
}

// --- getEffectiveLevelInfo() support -----------------------------------

// Long silence wipes the DISPLAYED rank back to tier 1 (their XP total is
// never touched). 35 days (~5 weeks) is long enough that a couple of missed
// days or a rough week don't trigger it, but genuinely quitting the habit
// does.
const INACTIVITY_RESET_DAYS = 35;

// Once decayed, the cap doesn't lift after a single check-in back — that
// would make the decay meaningless (check in once, instantly get your old
// rank back). Instead they need to show real renewed consistency: at least
// 21 of the last ~30 days checked in (roughly 3 solid weeks) before the cap
// is lifted again. This mirrors the constant submitCheckIn() uses in
// src/lib/firebase.js to pre-clear the `levelDecayedAt` flag.
const REQUALIFY_CHECKINS_30D = 21;

// Accepts Firestore Timestamps (has .toDate()), plain {seconds} timestamp-
// like objects, JS Dates, epoch millis, or ISO/"YYYY-MM-DD" strings. Returns
// null if it can't make sense of the value.
function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return new Date(value);
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function daysBetween(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

// Full profile -> effective, gated tier. Pure function of (profile, now) —
// no Firestore/async calls — so it's cheap to call from render paths.
//
// Gating rules, in order of precedence:
//   1. Inactivity decay: if `lastCheckIn` is >= INACTIVITY_RESET_DAYS old, OR
//      a prior decay was flagged (`levelDecayedAt` truthy) and the user
//      hasn't yet logged >= REQUALIFY_CHECKINS_30D check-ins in the last 30
//      days, the effective tier is forced to LEVELS[0] regardless of XP.
//   2. Otherwise, walk LEVELS bottom-up and stop at the first tier whose XP
//      threshold or optional minDaysSinceSignup/minRecentCheckins gate isn't
//      met yet — see the loop below for why this must be sequential rather
//      than "find the highest tier whose own conditions happen to pass".
// `profile.xp` itself is never modified by any of this — decay/gating only
// affects what's *displayed*.
export function getEffectiveLevelInfo(profile, now = new Date()) {
  const xp = (profile && profile.xp) || 0;
  const rawLevel = getLevelInfo(xp).current;

  const createdAt = toDateSafe(profile && profile.createdAt);
  // Unknown signup date is treated as "just signed up" (most restrictive) —
  // safer than silently granting time-gated tiers to malformed data.
  const daysSinceSignup = createdAt ? daysBetween(now, createdAt) : 0;

  let checkinsLast30d;
  if (typeof (profile && profile.checkinsLast30d) === "number") {
    checkinsLast30d = profile.checkinsLast30d;
  } else if (Array.isArray(profile && profile.recentCheckins)) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    checkinsLast30d = profile.recentCheckins.filter((d) => {
      const dd = toDateSafe(d);
      return dd && dd >= cutoff;
    }).length;
  } else {
    checkinsLast30d = 0;
  }

  const lastCheckInDate = toDateSafe(profile && profile.lastCheckIn);
  const liveStale = !!lastCheckInDate && daysBetween(now, lastCheckInDate) >= INACTIVITY_RESET_DAYS;
  const flaggedStale = !!(profile && profile.levelDecayedAt) && checkinsLast30d < REQUALIFY_CHECKINS_30D;
  const isDecayed = liveStale || flaggedStale;

  // Walk the ladder bottom-up and stop at the first tier whose requirements
  // aren't met. This is deliberately sequential rather than "find the
  // highest tier whose own conditions pass" — a higher tier that happens not
  // to carry e.g. a minRecentCheckins gate must not let someone leapfrog
  // past a lower tier that does carry one. You have to actually clear every
  // rung on the way up.
  let gatedIndex = 0;
  for (let i = 1; i < LEVELS.length; i++) {
    const tier = LEVELS[i];
    if (xp < tier.min) break;
    if ((tier.minDaysSinceSignup || 0) > daysSinceSignup) break;
    if ((tier.minRecentCheckins || 0) > checkinsLast30d) break;
    gatedIndex = i;
  }

  const effectiveIndex = isDecayed ? 0 : gatedIndex;
  const current = LEVELS[effectiveIndex];
  const next = LEVELS[effectiveIndex + 1] || null;
  const progressRaw = next ? ((xp - current.min) / (next.min - current.min)) * 100 : 100;
  const progress = Math.max(0, Math.min(100, progressRaw));

  return {
    current,
    next,
    progress,
    // Extra context beyond the base {current,next,progress} shape — additive,
    // safe for existing/future consumers to ignore.
    rawLevel,                                     // tier XP alone would predict
    isDecayed,                                     // true => capped by inactivity
    isGated: !isDecayed && current.num !== rawLevel.num, // true => capped by time/frequency gate
    daysSinceSignup,
    checkinsLast30d,
  };
}

export function getStreakBonus(streak) {
  if (streak >= 100) return { label: "CENTURY 🔥", mult: 3.0, color: "#FF4081" };
  if (streak >= 60)  return { label: "UNSTOPPABLE", mult: 2.5, color: "#FF4D4D" };
  if (streak >= 30)  return { label: "MONTHLY GRIND", mult: 2.0, color: "#FF9800" };
  if (streak >= 14)  return { label: "2-WEEK LOCK", mult: 1.7, color: "#D4A017" };
  if (streak >= 7)   return { label: "WEEK STREAK", mult: 1.5, color: "#00FF88" };
  if (streak >= 3)   return { label: "ON A ROLL", mult: 1.2, color: "#4DC9FF" };
  return { label: "", mult: 1.0, color: "#888" };
}

export const BREATHING_EXERCISES = [
  { id: "box",   name: "Box Breathing",     inhale: 4, hold1: 4, exhale: 4, hold2: 4, desc: "Calms the nervous system. Used by Navy SEALs." },
  { id: "478",   name: "4-7-8 Technique",   inhale: 4, hold1: 7, exhale: 8, hold2: 0, desc: "Reduces anxiety. Great before sleep or a big moment." },
  { id: "belly", name: "Belly Breathing",   inhale: 5, hold1: 0, exhale: 5, hold2: 0, desc: "Activates parasympathetic response. Good for focus." },
];

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
