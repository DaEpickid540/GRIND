// User settings — stored in localStorage (UI prefs) + Firebase (habit config)
// Separate from AI config intentionally

const LS_KEY = "grind_settings";

export const DEFAULT_SETTINGS = {
  // Appearance
  accentColor: "#FFD700",
  fontSize: "medium",       // small | medium | large
  compactMode: false,
  sidebarCollapsed: false,
  animationsEnabled: true,

  // Habits
  enabledCategories: ["fitness","selfcare","school","coding","social"],
  customHabits: [],         // [{ id, categoryId, label, xp }]

  // Gamification
  streakGracePeriod: 0,     // extra hours after midnight before streak breaks
  xpMultiplier: 1.0,
  showXPOnHabits: true,
  hardMode: false,          // all habits required for check-in to count

  // Notifications (web push — informational only, not wired to real push yet)
  streakReminderEnabled: true,
  streakReminderTime: "21:00",
  dailyPlanReminderEnabled: false,
  dailyPlanReminderTime: "08:00",

  // Data
  exportFormat: "json",
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
  applySettings(settings);
}

export function applySettings(s) {
  const root = document.documentElement;
  root.style.setProperty("--accent", s.accentColor || "#FFD700");
  root.style.setProperty("--font-scale", s.fontSize==="small"?"0.9":s.fontSize==="large"?"1.1":"1");
  document.body.classList.toggle("compact-mode", !!s.compactMode);
  document.body.classList.toggle("no-animations", !s.animationsEnabled);
}

// Apply on load
applySettings(getSettings());
