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
    color: "#FFD700",
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

export const LEVELS = [
  { min: 0,     num: 1,  title: "Couch Potato",    color: "#888",    emoji: "🥔" },
  { min: 200,   num: 2,  title: "Getting Started", color: "#4CAF50", emoji: "🌱" },
  { min: 500,   num: 3,  title: "Consistent",      color: "#2196F3", emoji: "💧" },
  { min: 1000,  num: 4,  title: "Grinder",         color: "#9C27B0", emoji: "⚙️" },
  { min: 2000,  num: 5,  title: "Locked In",       color: "#FF9800", emoji: "🔒" },
  { min: 4000,  num: 6,  title: "Varsity Ready",   color: "#F44336", emoji: "🏅" },
  { min: 7000,  num: 7,  title: "Elite",           color: "#FFD700", emoji: "⭐" },
  { min: 10000, num: 8,  title: "GOAT",            color: "#FF4081", emoji: "🐐" },
];

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

export function getStreakBonus(streak) {
  if (streak >= 100) return { label: "CENTURY 🔥", mult: 3.0, color: "#FF4081" };
  if (streak >= 60)  return { label: "UNSTOPPABLE", mult: 2.5, color: "#FF4D4D" };
  if (streak >= 30)  return { label: "MONTHLY GRIND", mult: 2.0, color: "#FF9800" };
  if (streak >= 14)  return { label: "2-WEEK LOCK", mult: 1.7, color: "#FFD700" };
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
