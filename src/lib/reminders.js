// In-session reminder system using Web Notifications API.
// Fires while the app tab is open. For background reminders use FCM (settings notif tab).

import { getSettings, saveSettings } from "./userSettings";

const REMINDERS = [
  { id: "water",   icon: "💧", label: "Drink Water",      msg: "Hydrate, king. Grab some water.",            defaultMin: 60 },
  { id: "posture", icon: "🧍", label: "Posture Check",     msg: "Sit up straight. Shoulders back.",            defaultMin: 45 },
  { id: "stretch", icon: "🤸", label: "Stretch Break",     msg: "Time to stretch — even 30 seconds counts.",   defaultMin: 90 },
  { id: "eyes",    icon: "👀", label: "Eye Break (20/20/20)", msg: "Look 20ft away for 20 seconds.",          defaultMin: 20 },
  { id: "move",    icon: "🚶", label: "Move Break",        msg: "Get up and walk around for a minute.",        defaultMin: 60 },
  { id: "breath",  icon: "🌬️", label: "Deep Breath",       msg: "Take 3 deep breaths. Reset.",                  defaultMin: 120 },
];

export function getRemindersList() { return REMINDERS; }

// Default reminder settings shape
export function getReminderSettings() {
  const s = getSettings();
  const r = s.reminders || {};
  const out = {};
  REMINDERS.forEach(({ id, defaultMin }) => {
    out[id] = r[id] || { enabled: false, interval: defaultMin };
  });
  return out;
}

export function setReminderSetting(id, patch) {
  const s = getSettings();
  const r = { ...(s.reminders || {}) };
  r[id] = { ...(r[id] || {}), ...patch };
  saveSettings({ ...s, reminders: r });
  scheduleAll();
}

// Internal timer tracking
const timers = new Map();
let started = false;

export async function ensurePermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function fireReminder(reminder) {
  if (document.hidden) {
    // Background: try the system notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${reminder.icon} ${reminder.label}`, {
        body: reminder.msg, icon: "/icon-192.png", tag: reminder.id,
      });
    }
  } else {
    // Foreground: use the in-app toast system if available
    if (window.__grindToast) {
      window.__grindToast(`${reminder.icon} ${reminder.msg}`, "info", 5000);
    } else if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`${reminder.icon} ${reminder.label}`, {
        body: reminder.msg, icon: "/icon-192.png", tag: reminder.id,
      });
    }
  }
}

export function scheduleAll() {
  stopAll();
  const settings = getReminderSettings();
  REMINDERS.forEach(reminder => {
    const cfg = settings[reminder.id];
    if (!cfg?.enabled || !cfg.interval) return;
    const ms = cfg.interval * 60 * 1000;
    const handle = setInterval(() => fireReminder(reminder), ms);
    timers.set(reminder.id, handle);
  });
}

export function stopAll() {
  timers.forEach(h => clearInterval(h));
  timers.clear();
}

// Start the system. Should be called once at app boot.
export function initReminders() {
  if (started) return;
  started = true;
  scheduleAll();
}
