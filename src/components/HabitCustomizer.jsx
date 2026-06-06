import { useState } from "react";
import { HABIT_CATEGORIES, EXCUSES } from "../data/gameData";

export default function HabitCustomizer({ categories, excuses, onSaveCategories, onSaveExcuses, onClose }) {
  const [tab,    setTab]    = useState("habits");
  const [cats,   setCats]   = useState(() => JSON.parse(JSON.stringify(categories)));
  const [excs,   setExcs]   = useState(() => [...excuses]);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── New category form ──────────────────────────────────────────────────
  const [addingCat, setAddingCat] = useState(false);
  const [newCat,    setNewCat]    = useState({ label: "", icon: "⭐", color: "#FFD700" });

  // ── New habit form per category ────────────────────────────────────────
  // { [catKey]: { label: "", xp: 10 } }
  const [newHabit, setNewHabit] = useState({});

  // ── Editing category header ────────────────────────────────────────────
  const [editCat, setEditCat] = useState(null);

  // ── New excuse form ────────────────────────────────────────────────────
  const [addingExc, setAddingExc] = useState(false);
  const [newExc,    setNewExc]    = useState({ label: "", icon: "🎉", days: 1 });

  // ── Save ───────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      // If user deleted all categories, pass null so defaults kick in
      const catPayload = Object.keys(cats).length > 0 ? cats : null;
      await onSaveCategories(catPayload);
      await onSaveExcuses(excs.length > 0 ? excs : null);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setCats(JSON.parse(JSON.stringify(HABIT_CATEGORIES)));
    setExcs([...EXCUSES]);
    setConfirmReset(false);
  }

  // ── Category CRUD ──────────────────────────────────────────────────────
  function addCategory() {
    if (!newCat.label.trim()) return;
    const key = `cat_${Date.now()}`;
    setCats(prev => ({
      ...prev,
      [key]: { label: newCat.label.trim(), icon: newCat.icon || "⭐", color: newCat.color, habits: [] },
    }));
    setNewCat({ label: "", icon: "⭐", color: "#FFD700" });
    setAddingCat(false);
  }

  function updateCat(key, field, value) {
    setCats(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function deleteCategory(key) {
    setCats(prev => { const next = { ...prev }; delete next[key]; return next; });
    if (editCat === key) setEditCat(null);
  }

  // ── Habit CRUD ─────────────────────────────────────────────────────────
  function addHabit(catKey) {
    const h = newHabit[catKey];
    if (!h?.label?.trim()) return;
    const id  = `h_${Date.now()}`;
    const xp  = Math.max(1, Math.min(99, parseInt(h.xp) || 10));
    setCats(prev => ({
      ...prev,
      [catKey]: { ...prev[catKey], habits: [...prev[catKey].habits, { id, label: h.label.trim(), xp }] },
    }));
    setNewHabit(prev => ({ ...prev, [catKey]: { label: "", xp: 10 } }));
  }

  function deleteHabit(catKey, habitId) {
    setCats(prev => ({
      ...prev,
      [catKey]: { ...prev[catKey], habits: prev[catKey].habits.filter(h => h.id !== habitId) },
    }));
  }

  // ── Excuse CRUD ────────────────────────────────────────────────────────
  function addExcuse() {
    if (!newExc.label.trim()) return;
    const id   = `exc_${Date.now()}`;
    const days = Math.max(1, Math.min(30, parseInt(newExc.days) || 1));
    setExcs(prev => [...prev, { id, label: newExc.label.trim(), icon: newExc.icon || "🎉", days }]);
    setNewExc({ label: "", icon: "🎉", days: 1 });
    setAddingExc(false);
  }

  function deleteExcuse(id) {
    setExcs(prev => prev.filter(e => e.id !== id));
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal customizer-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="cust-header">
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Customize Your Tracker</h3>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>
              Changes are saved to your account
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className={`cust-reset-btn ${confirmReset ? "confirm" : ""}`}
              onClick={handleReset}
              title="Reset to default habits"
            >
              {confirmReset ? "⚠️ Confirm reset?" : "↺ Reset defaults"}
            </button>
            <button className="cust-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="cust-tabs">
          <button className={`cust-tab ${tab === "habits" ? "active" : ""}`} onClick={() => setTab("habits")}>
            📋 Habits
          </button>
          <button className={`cust-tab ${tab === "excuses" ? "active" : ""}`} onClick={() => setTab("excuses")}>
            ⛺ Excuses
          </button>
        </div>

        {/* Body */}
        <div className="cust-body">

          {/* ── HABITS TAB ── */}
          {tab === "habits" && (
            <div className="cust-habits-tab">
              {Object.keys(cats).length === 0 && (
                <div className="cust-empty">No categories yet. Add one below!</div>
              )}

              {Object.entries(cats).map(([key, cat]) => (
                <div key={key} className="cust-category">

                  {/* Category header — normal vs edit mode */}
                  {editCat === key ? (
                    <div className="cust-cat-edit-row">
                      <input
                        className="cust-input cust-input-icon"
                        value={cat.icon}
                        maxLength={2}
                        onChange={e => updateCat(key, "icon", e.target.value)}
                        title="Emoji icon"
                      />
                      <input
                        className="cust-input cust-input-flex"
                        value={cat.label}
                        placeholder="Category name"
                        onChange={e => updateCat(key, "label", e.target.value)}
                        onKeyDown={e => e.key === "Enter" && setEditCat(null)}
                        autoFocus
                      />
                      <input
                        type="color"
                        className="cust-color-pick"
                        value={cat.color}
                        onChange={e => updateCat(key, "color", e.target.value)}
                        title="Pick color"
                      />
                      <button className="cust-btn-sm primary" onClick={() => setEditCat(null)}>Done</button>
                    </div>
                  ) : (
                    <div className="cust-cat-header" style={{ borderLeft: `3px solid ${cat.color}` }}>
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <span className="cust-cat-name" style={{ color: cat.color }}>{cat.label}</span>
                      <span className="cust-cat-count">{cat.habits.length} habit{cat.habits.length !== 1 ? "s" : ""}</span>
                      <button className="cust-icon-btn" onClick={() => setEditCat(key)} title="Edit" aria-label={`Edit ${cat.label}`}>✏️</button>
                      <button className="cust-icon-btn danger" onClick={() => deleteCategory(key)} title="Delete category" aria-label={`Delete ${cat.label}`}>🗑</button>
                    </div>
                  )}

                  {/* Habit list */}
                  <div className="cust-habits-list">
                    {cat.habits.length === 0 && (
                      <div className="cust-no-habits">No habits yet — add one below</div>
                    )}
                    {cat.habits.map(h => (
                      <div key={h.id} className="cust-habit-row">
                        <span className="cust-habit-label">{h.label}</span>
                        <span className="cust-habit-xp">+{h.xp}</span>
                        <button
                          className="cust-icon-btn danger sm"
                          onClick={() => deleteHabit(key, h.id)}
                          aria-label={`Delete ${h.label}`}
                        >✕</button>
                      </div>
                    ))}

                    {/* Add habit inline */}
                    <div className="cust-add-habit-row">
                      <input
                        className="cust-input cust-input-flex"
                        placeholder="New habit…"
                        value={newHabit[key]?.label ?? ""}
                        onChange={e => setNewHabit(p => ({ ...p, [key]: { ...p[key], label: e.target.value } }))}
                        onKeyDown={e => e.key === "Enter" && addHabit(key)}
                      />
                      <input
                        className="cust-input cust-input-xp"
                        type="number"
                        placeholder="XP"
                        min={1} max={99}
                        value={newHabit[key]?.xp ?? ""}
                        onChange={e => setNewHabit(p => ({ ...p, [key]: { ...p[key], xp: e.target.value } }))}
                        onKeyDown={e => e.key === "Enter" && addHabit(key)}
                      />
                      <button className="cust-btn-sm add" onClick={() => addHabit(key)}>+ Add</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add category */}
              {addingCat ? (
                <div className="cust-new-form">
                  <input
                    className="cust-input cust-input-icon"
                    value={newCat.icon}
                    maxLength={2}
                    onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))}
                    title="Emoji icon"
                  />
                  <input
                    className="cust-input cust-input-flex"
                    value={newCat.label}
                    placeholder="Category name…"
                    onChange={e => setNewCat(p => ({ ...p, label: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addCategory()}
                    autoFocus
                  />
                  <input
                    type="color"
                    className="cust-color-pick"
                    value={newCat.color}
                    onChange={e => setNewCat(p => ({ ...p, color: e.target.value }))}
                  />
                  <button className="cust-btn-sm primary" onClick={addCategory}>Add</button>
                  <button className="cust-btn-sm" onClick={() => setAddingCat(false)}>✕</button>
                </div>
              ) : (
                <button className="cust-add-section-btn" onClick={() => setAddingCat(true)}>
                  + Add Category
                </button>
              )}
            </div>
          )}

          {/* ── EXCUSES TAB ── */}
          {tab === "excuses" && (
            <div className="cust-excuses-tab">
              <p className="cust-hint">Excuses protect your streak for the number of days shown.</p>

              {excs.map(ex => (
                <div key={ex.id} className="cust-excuse-row">
                  <span className="cust-exc-icon">{ex.icon}</span>
                  <span className="cust-exc-label">{ex.label}</span>
                  <span className="cust-exc-days">{ex.days} day{ex.days !== 1 ? "s" : ""}</span>
                  <button
                    className="cust-icon-btn danger sm"
                    onClick={() => deleteExcuse(ex.id)}
                    aria-label={`Delete ${ex.label}`}
                  >✕</button>
                </div>
              ))}

              {addingExc ? (
                <div className="cust-new-form">
                  <input
                    className="cust-input cust-input-icon"
                    value={newExc.icon}
                    maxLength={2}
                    onChange={e => setNewExc(p => ({ ...p, icon: e.target.value }))}
                    title="Emoji icon"
                  />
                  <input
                    className="cust-input cust-input-flex"
                    value={newExc.label}
                    placeholder="Excuse label…"
                    onChange={e => setNewExc(p => ({ ...p, label: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addExcuse()}
                    autoFocus
                  />
                  <input
                    className="cust-input cust-input-days"
                    type="number"
                    min={1} max={30}
                    placeholder="Days"
                    value={newExc.days}
                    onChange={e => setNewExc(p => ({ ...p, days: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addExcuse()}
                  />
                  <button className="cust-btn-sm primary" onClick={addExcuse}>Add</button>
                  <button className="cust-btn-sm" onClick={() => setAddingExc(false)}>✕</button>
                </div>
              ) : (
                <button className="cust-add-section-btn" onClick={() => setAddingExc(true)}>
                  + Add Excuse
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cust-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: "10px 28px" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
