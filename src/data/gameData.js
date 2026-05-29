// src/data/gameData.js

export const HABIT_CATEGORIES = {
  fitness: {
    label: "Fitness",
    icon: "🏋️",
    color: "#FF4D4D",
    habits: [
      { id: "workout",       label: "Worked out today",           xp: 15 },
      { id: "cardio",        label: "Did cardio (run/bike/swim)",  xp: 10 },
      { id: "stretch",       label: "Stretched / mobility work",  xp:  5 },
      { id: "sport_practice",label: "Sport practice / team drill", xp: 15 },
      { id: "steps",         label: "Hit 8k+ steps",              xp:  8 },
    ],
  },
  selfcare: {
    label: "Self Care",
    icon: "🚿",
    color: "#4DC9FF",
    habits: [
      { id: "shower",   label: "Showered",               xp:  5 },
      { id: "teeth",    label: "Brushed teeth (×2)",      xp:  5 },
      { id: "skincare", label: "Did skincare routine",    xp:  5 },
      { id: "sleep8",   label: "Slept 8+ hours",          xp: 10 },
      { id: "ate_well", label: "Ate clean / tracked macros", xp: 10 },
      { id: "water",    label: "Drank 8+ glasses of water", xp:  5 },
      { id: "groomed",  label: "Hair / grooming on point", xp:  5 },
    ],
  },
  school: {
    label: "School",
    icon: "📚",
    color: "#FFD700",
    habits: [
      { id: "homework",   label: "Finished all homework",       xp: 15 },
      { id: "studied",    label: "Studied 30+ min",             xp: 10 },
      { id: "no_phone",   label: "No phone during class",       xp: 10 },
      { id: "organized",  label: "Organized notes/backpack",    xp:  5 },
      { id: "participated", label: "Participated in class",     xp:  8 },
    ],
  },
  coding: {
    label: "Coding",
    icon: "💻",
    color: "#00FF88",
    habits: [
      { id: "coded",     label: "Coded / built something",      xp: 15 },
      { id: "course",    label: "Did Udemy / course lesson",    xp: 10 },
      { id: "committed", label: "Pushed a commit to GitHub",    xp: 10 },
      { id: "read_docs", label: "Read docs / learned a concept", xp:  8 },
    ],
  },
  social: {
    label: "Social",
    icon: "🧠",
    color: "#FF88FF",
    habits: [
      { id: "looked_good",    label: "Put effort into your fit",          xp: 10 },
      { id: "real_convo",     label: "Had a real conversation IRL",       xp: 10 },
      { id: "no_doom",        label: "Avoided doom scrolling (1hr+ free)", xp: 10 },
      { id: "comfort_zone",   label: "Did something outside comfort zone", xp: 15 },
      { id: "positive_self",  label: "Practiced positive self-talk",       xp:  8 },
    ],
  },
};

export const ALL_HABITS = Object.values(HABIT_CATEGORIES).flatMap(c => c.habits);

export const EXCUSES = [
  { id: "camping",    label: "Camping / Outdoors",     icon: "⛺", days: 3 },
  { id: "vacation",   label: "Vacation / Travel",      icon: "✈️", days: 7 },
  { id: "sick",       label: "Sick Day",               icon: "🤒", days: 2 },
  { id: "family",     label: "Family Emergency",       icon: "🏠", days: 2 },
  { id: "daytrip",    label: "Day Trip",               icon: "🚗", days: 1 },
  { id: "scouts",     label: "Scouts / OA Event",      icon: "🏕️", days: 3 },
  { id: "tournament", label: "Sports Tournament",      icon: "🏆", days: 2 },
  { id: "exam",       label: "Exam Week",              icon: "📝", days: 5 },
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
