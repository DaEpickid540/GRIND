// ── GRIND Store — all cosmetic items ─────────────────────────────────────
// Every item is purely cosmetic. Earned by working out, never paid for.
// 1 coin = 1 habit completed (regardless of XP value).
//
// Fields:
//   id          — unique string key
//   type        — "title" | "badge" | "frame" | "streak"
//   equip_slot  — the slot name used in profile.equippedItems
//   name        — display name
//   display     — what is actually rendered when equipped
//               (text for titles, emoji for badge/streak, CSS class key for frames)
//   cost        — coins required
//   rarity      — "common" | "uncommon" | "rare" | "epic" | "legendary"
//   icon        — emoji shown on the store card
//   desc        — flavour text

export const STORE_ITEMS = [
  // ─── TITLES ────────────────────────────────────────────────────────────
  // Shown next to the user's name in the sidebar + leaderboard
  {
    id: "title_grinder",
    type: "title", equip_slot: "title",
    name: "Grinder",   display: "Grinder",
    cost: 75,   rarity: "common",    icon: "⚙️",
    desc: "Can't stop, won't stop.",
  },
  {
    id: "title_locked_in",
    type: "title", equip_slot: "title",
    name: "Locked In", display: "Locked In",
    cost: 200,  rarity: "uncommon",  icon: "🔒",
    desc: "Zero distractions. Pure output.",
  },
  {
    id: "title_no_days_off",
    type: "title", equip_slot: "title",
    name: "No Days Off", display: "No Days Off",
    cost: 450,  rarity: "rare",      icon: "📅",
    desc: "Every single day. No exceptions.",
  },
  {
    id: "title_built_diff",
    type: "title", equip_slot: "title",
    name: "Built Different", display: "Built Different",
    cost: 800,  rarity: "epic",      icon: "💪",
    desc: "You operate on a different level.",
  },
  {
    id: "title_machine",
    type: "title", equip_slot: "title",
    name: "The Machine", display: "The Machine",
    cost: 1500, rarity: "epic",      icon: "⚡",
    desc: "Relentless. Unstoppable. Inevitable.",
  },
  {
    id: "title_goat",
    type: "title", equip_slot: "title",
    name: "THE GOAT",   display: "THE GOAT",
    cost: 5000, rarity: "legendary", icon: "🐐",
    desc: "Greatest of all time. Period.",
  },

  // ─── BADGES ────────────────────────────────────────────────────────────
  // An emoji icon shown next to the avatar in the sidebar
  {
    id: "badge_bolt",
    type: "badge", equip_slot: "badge",
    name: "Static",     display: "⚡",
    cost: 50,   rarity: "common",    icon: "⚡",
    desc: "Quick and consistent.",
  },
  {
    id: "badge_target",
    type: "badge", equip_slot: "badge",
    name: "Sharpshooter", display: "🎯",
    cost: 100,  rarity: "common",    icon: "🎯",
    desc: "Always on target.",
  },
  {
    id: "badge_fire",
    type: "badge", equip_slot: "badge",
    name: "Pyro",       display: "🔥",
    cost: 200,  rarity: "uncommon",  icon: "🔥",
    desc: "You run hot. Always.",
  },
  {
    id: "badge_skull",
    type: "badge", equip_slot: "badge",
    name: "Reaper",     display: "💀",
    cost: 600,  rarity: "rare",      icon: "💀",
    desc: "Merciless grinder. Rest is for others.",
  },
  {
    id: "badge_gem",
    type: "badge", equip_slot: "badge",
    name: "Diamond",    display: "💎",
    cost: 1200, rarity: "epic",      icon: "💎",
    desc: "Pressure makes diamonds. You're proof.",
  },
  {
    id: "badge_crown",
    type: "badge", equip_slot: "badge",
    name: "Royalty",    display: "👑",
    cost: 2500, rarity: "epic",      icon: "👑",
    desc: "Born to rule.",
  },
  {
    id: "badge_trophy",
    type: "badge", equip_slot: "badge",
    name: "Champion",   display: "🏆",
    cost: 5000, rarity: "legendary", icon: "🏆",
    desc: "One of the all-time greats.",
  },

  // ─── AVATAR FRAMES ─────────────────────────────────────────────────────
  // CSS ring/glow applied around the profile photo
  {
    id: "frame_silver",
    type: "frame", equip_slot: "frame",
    name: "Silver Ring", display: "silver",
    cost: 150,  rarity: "common",    icon: "⬜",
    desc: "Clean, minimal silver border.",
  },
  {
    id: "frame_gold",
    type: "frame", equip_slot: "frame",
    name: "Gold Ring",   display: "gold",
    cost: 400,  rarity: "uncommon",  icon: "🟡",
    desc: "A rich gold halo around your avatar.",
  },
  {
    id: "frame_fire",
    type: "frame", equip_slot: "frame",
    name: "Flame Frame", display: "fire",
    cost: 800,  rarity: "rare",      icon: "🔴",
    desc: "Red-hot flame aura. Makes profiles burn.",
  },
  {
    id: "frame_purple",
    type: "frame", equip_slot: "frame",
    name: "Royal Purple", display: "purple",
    cost: 1000, rarity: "epic",      icon: "🟣",
    desc: "Deep royal purple glow.",
  },
  {
    id: "frame_rainbow",
    type: "frame", equip_slot: "frame",
    name: "Rainbow",     display: "rainbow",
    cost: 2500, rarity: "legendary", icon: "🌈",
    desc: "Animated rainbow ring. The rarest flex.",
  },

  // ─── STREAK ICON ───────────────────────────────────────────────────────
  // Replaces the 🔥 emoji in the streak counter
  {
    id: "streak_ice",
    type: "streak", equip_slot: "streak",
    name: "Glacier",    display: "❄️",
    cost: 250,  rarity: "uncommon",  icon: "❄️",
    desc: "Ice-cold consistency. Never melts.",
  },
  {
    id: "streak_electric",
    type: "streak", equip_slot: "streak",
    name: "Electric",   display: "⚡",
    cost: 450,  rarity: "rare",      icon: "⚡",
    desc: "Shocking consistency.",
  },
  {
    id: "streak_star",
    type: "streak", equip_slot: "streak",
    name: "Star Power",  display: "⭐",
    cost: 700,  rarity: "rare",      icon: "⭐",
    desc: "Shining every single day.",
  },
  {
    id: "streak_dragon",
    type: "streak", equip_slot: "streak",
    name: "Dragon",     display: "🐉",
    cost: 2000, rarity: "legendary", icon: "🐉",
    desc: "Ancient. Powerful. Eternal.",
  },
];

export const RARITY_COLORS = {
  common:    "#888",
  uncommon:  "#00CC66",
  rare:      "#4DC9FF",
  epic:      "#B84DFF",
  legendary: "#FFD700",
};

export const RARITY_ORDER = ["common","uncommon","rare","epic","legendary"];

export function getItemById(id) {
  return STORE_ITEMS.find(i => i.id === id) || null;
}
