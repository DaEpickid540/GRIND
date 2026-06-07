// User settings — stored in localStorage (UI prefs) + Firebase (habit config)
// Separate from AI config intentionally

const LS_KEY = "grind_settings";

export const DEFAULT_SETTINGS = {
  // Appearance
  theme: "dark",            // dark | light | auto
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

// Resolve "auto" to the OS-level light/dark preference
function resolveTheme(theme) {
  if (theme === "light" || theme === "dark") return theme;
  // auto — follow system preference
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch { return "dark"; }
}

let _mqlBound = false;

export function applySettings(s) {
  const root = document.documentElement;
  root.style.setProperty("--accent", s.accentColor || "#FFD700");
  root.style.setProperty("--font-scale", s.fontSize==="small"?"0.9":s.fontSize==="large"?"1.1":"1");
  document.body.classList.toggle("compact-mode", !!s.compactMode);
  document.body.classList.toggle("no-animations", !s.animationsEnabled);

  const resolved = resolveTheme(s.theme || "dark");
  root.setAttribute("data-theme", resolved);

  // If the user picked "auto", live-update when the OS preference changes
  if (s.theme === "auto" && !_mqlBound && window.matchMedia) {
    try {
      const mql = window.matchMedia("(prefers-color-scheme: light)");
      mql.addEventListener("change", () => {
        const cur = getSettings();
        if (cur.theme === "auto") root.setAttribute("data-theme", mql.matches ? "light" : "dark");
      });
      _mqlBound = true;
    } catch { /* matchMedia listener not supported — ignore */ }
  }
}

// Apply on load
applySettings(getSettings());
