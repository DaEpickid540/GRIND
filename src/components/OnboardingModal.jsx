// Forced onboarding flow — collects context for the AI to actually know the user.
// Shows after Google login + API key setup, before they see the app.
import { useState } from "react";
import { saveOnboarding } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "./Toast";
import { saveSearchConfig, getSearchConfig } from "../lib/searchProvider";

// Map the friendly onboarding label to the internal search-provider id
const SEARCH_PREF_TO_ID = {
  "ContextWire (recommended)": "contextwire",
  "SerpAPI": "serpapi",
  "Brave Search": "brave",
};

function applySearchPref(pref) {
  const id = SEARCH_PREF_TO_ID[pref];
  if (!id) return; // "Not now" or unset — leave default config alone
  saveSearchConfig({ ...getSearchConfig(), provider: id });
}

const STEPS = [
  // ── 1. Intro + freeform additional info ───────────────────
  {
    id: "intro",
    title: "Yo, let's get to know you.",
    sub: "I'll ask you some real questions so the coaching actually fits YOU, not some generic dude. Anything you share stays private and only personalizes the AI.",
    fields: [
      {
        key: "additionalInfo",
        label: "Anything else the AI should know about you?",
        type: "textarea",
        placeholder: "e.g. I throw shot put for Mason High School, finals in 3 weeks, I drink way too much coffee, my best friend just moved away, training for a 5k in May...",
        sub: "Optional but super useful. The more specific, the better the coaching.",
        rows: 5,
      },
    ],
  },

  // ── 2. Basics ─────────────────────────────────────────────
  {
    id: "basics",
    title: "The basics",
    sub: "Quick stats. Skip anything that's not your business.",
    fields: [
      { key: "age",        label: "Age",     type: "number",  placeholder: "16", min: 13, max: 99 },
      { key: "gender",     label: "Gender",  type: "select",  options: ["Male","Female","Non-binary","Prefer not to say"] },
      { key: "weight",     label: "Weight",  type: "number",  placeholder: "150", min: 50, max: 500 },
      { key: "weightUnit", label: "Unit",    type: "select",  options: ["lbs","kg"], defaultValue: "lbs" },
      { key: "height",     label: "Height",  type: "text",    placeholder: "5'10\" or 178cm" },
    ],
  },

  // ── 3. Goals ──────────────────────────────────────────────
  {
    id: "goals",
    title: "What are you actually trying to do?",
    sub: "Be specific. \"Get in shape\" is fine but \"Make varsity baseball\" is gold.",
    fields: [
      {
        key: "primaryGoal", label: "Main goal", type: "textarea",
        placeholder: "Make varsity, get to 12% bodyfat, become more confident, learn full-stack dev...",
        required: true, rows: 2,
      },
      {
        key: "secondaryGoals", label: "Also want to (multi-select)", type: "multiselect",
        options: ["Build muscle","Lose weight","Make new friends","Get better grades","Learn a new skill","Make money","Be more confident","Sleep better","Stop a bad habit","Try harder things"],
      },
      {
        key: "motivation", label: "What drives you?", type: "textarea",
        placeholder: "What's the real reason behind it? Be honest with yourself.", rows: 2,
      },
    ],
  },

  // ── 4. Activity & Sport ───────────────────────────────────
  {
    id: "activity",
    title: "How active are you right now?",
    sub: "Real talk — I need the actual current state, not what you wish it was.",
    fields: [
      {
        key: "activityLevel", label: "Activity level", type: "select",
        options: ["Sedentary (barely move)","Lightly active (walk daily)","Moderately active (exercise 3-4x/wk)","Very active (intense 5+/wk)","Athlete (training daily)"],
      },
      { key: "exerciseFreq", label: "Workouts per week", type: "number", placeholder: "3", min: 0, max: 14 },
      { key: "sport",        label: "Main sport or activity (if any)", type: "text", placeholder: "Basketball, lifting, cross country..." },
    ],
  },

  // ── 5. Diet ───────────────────────────────────────────────
  {
    id: "diet",
    title: "What's your diet situation?",
    sub: "Doesn't have to be perfect — just where you're at.",
    fields: [
      {
        key: "diet", label: "Eating style", type: "select",
        options: ["No restrictions","Vegetarian","Vegan","Pescatarian","Keto/Low-carb","Halal","Kosher","Other"],
      },
      { key: "dietaryRestrictions", label: "Allergies / things you avoid", type: "text", placeholder: "Peanuts, dairy, gluten..." },
    ],
  },

  // ── 6. Sleep & stress ─────────────────────────────────────
  {
    id: "wellness",
    title: "Sleep and stress",
    sub: "Two huge ones most apps ignore.",
    fields: [
      { key: "sleepHours",  label: "Average sleep per night (hours)", type: "number", min: 3, max: 14, placeholder: "7" },
      { key: "stressLevel", label: "Stress level (1-10)",              type: "slider",  min: 1, max: 10, defaultValue: 5 },
      { key: "confidence",  label: "Self-confidence (1-10)",           type: "slider",  min: 1, max: 10, defaultValue: 5 },
    ],
  },

  // ── 7. Struggles ──────────────────────────────────────────
  {
    id: "struggles",
    title: "What do you struggle with?",
    sub: "Pick everything that's a real obstacle. The AI uses this to push the right buttons.",
    fields: [
      {
        key: "struggles", label: "Currently struggling with", type: "multiselect",
        options: ["Procrastination","Social anxiety","Phone addiction","Doom scrolling","Junk food","Inconsistent sleep","Low motivation","Comparison/jealousy","Not enough time","Overthinking","Self-doubt","Distractions during work"],
      },
      {
        key: "biggestObstacle", label: "Your biggest obstacle right now", type: "textarea",
        placeholder: "What's actually getting in the way? Be specific.", rows: 2,
      },
    ],
  },

  // ── 8. Internet search ────────────────────────────────────
  {
    id: "search",
    title: "Want the AI to search the live web?",
    sub: "Some questions need fresh info — current events, recent studies, today's prices. Pick a provider now (you'll add the actual API key later in Settings → Search), or skip for now.",
    fields: [
      {
        key: "searchProviderPref", label: "Preferred search provider", type: "select",
        options: ["ContextWire (recommended)", "SerpAPI", "Brave Search", "Not now — I'll set it up later"],
        defaultValue: "ContextWire (recommended)",
      },
    ],
  },
];

const TOTAL_STEPS = STEPS.length;

export default function OnboardingModal({ onDone }) {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving,  setSaving]  = useState(false);

  const step = STEPS[stepIdx];
  const isLast  = stepIdx === TOTAL_STEPS - 1;
  const isFirst = stepIdx === 0;

  function update(key, val) { setAnswers(a => ({ ...a, [key]: val })); }
  function toggleMulti(key, val) {
    setAnswers(a => {
      const cur = a[key] || [];
      return { ...a, [key]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
    });
  }

  function canContinue() {
    if (!step.fields.length) return true;
    const required = step.fields.filter(f => f.required);
    return required.every(f => answers[f.key]?.toString().trim());
  }

  async function handleNext() {
    if (!isLast) { setStepIdx(i => i + 1); return; }
    setSaving(true);
    try {
      applySearchPref(answers.searchProviderPref);
      await saveOnboarding(user.uid, answers);
      await refreshProfile();
      toast("Let's go 🔥 You're locked in.", "success");
      onDone();
    } catch(e) {
      toast("Couldn't save — try again", "error");
      console.error(e);
    } finally { setSaving(false); }
  }

  async function handleSkipAll() {
    setSaving(true);
    try {
      await saveOnboarding(user.uid, { skipped: true, ...answers });
      await refreshProfile();
      toast("Cool, skipped for now. Fill it in Settings whenever.", "info");
      onDone();
    } catch(e) { toast("Couldn't save", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="onboard-overlay">
      <div className="onboard-modal">
        <div className="onboard-progress-wrap">
          <div className="onboard-progress-bar">
            <div className="onboard-progress-fill" style={{ width: `${((stepIdx+1) / TOTAL_STEPS) * 100}%` }}/>
          </div>
          <div className="onboard-progress-text">{stepIdx+1} / {TOTAL_STEPS}</div>
        </div>

        <div className="onboard-body">
          <h2 className="onboard-title">{step.title}</h2>
          {step.sub && <p className="onboard-sub">{step.sub}</p>}

          <div className="onboard-fields">
            {step.fields.map(field => (
              <FieldInput key={field.key} field={field} value={answers[field.key]}
                onChange={v => update(field.key, v)}
                onToggle={v => toggleMulti(field.key, v)}/>
            ))}
          </div>
        </div>

        <div className="onboard-footer">
          <button className="onboard-back" onClick={() => setStepIdx(i => Math.max(0, i-1))} disabled={isFirst}>← Back</button>
          <button className="onboard-skip-all" onClick={handleSkipAll} disabled={saving}>Skip all for now</button>
          <button className="btn-primary onboard-next" onClick={handleNext}
            disabled={!canContinue() || saving} style={{ width:"auto", padding:"10px 32px" }}>
            {saving ? "Saving..." : isLast ? "🔥 Let's Go" : isFirst ? "Start" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange, onToggle }) {
  if (field.type === "text" || field.type === "number") {
    return (
      <div className="onboard-field">
        <label className="onboard-label">{field.label}{field.required && <span style={{ color:"#FF4D4D" }}>*</span>}</label>
        <input className="inp" type={field.type} placeholder={field.placeholder}
          value={value ?? ""} min={field.min} max={field.max}
          onChange={e => onChange(e.target.value)}/>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="onboard-field">
        <label className="onboard-label">{field.label}{field.required && <span style={{ color:"#FF4D4D" }}>*</span>}</label>
        {field.sub && <div className="onboard-field-sub">{field.sub}</div>}
        <textarea className="inp" rows={field.rows || 3} placeholder={field.placeholder}
          value={value ?? ""} onChange={e => onChange(e.target.value)}
          style={{ resize:"vertical", fontFamily:"'Syne',sans-serif" }}/>
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="onboard-field">
        <label className="onboard-label">{field.label}</label>
        <select className="inp" value={value || field.defaultValue || ""} onChange={e => onChange(e.target.value)}>
          <option value="">Choose...</option>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "multiselect") {
    return (
      <div className="onboard-field">
        <label className="onboard-label">{field.label}</label>
        <div className="onboard-chips">
          {field.options.map(opt => {
            const active = (value || []).includes(opt);
            return (
              <button key={opt} type="button" className={`onboard-chip ${active?"active":""}`} onClick={() => onToggle(opt)}>
                {active && "✓ "}{opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "slider") {
    const v = value ?? field.defaultValue ?? field.min;
    return (
      <div className="onboard-field">
        <label className="onboard-label" style={{ display:"flex", justifyContent:"space-between" }}>
          <span>{field.label}</span>
          <span style={{ color:"#FFD700", fontFamily:"'Bebas Neue',sans-serif", fontSize:18 }}>{v}</span>
        </label>
        <input type="range" min={field.min} max={field.max} value={v}
          onChange={e => onChange(+e.target.value)} className="onboard-slider"/>
        <div className="onboard-slider-ticks"><span>{field.min}</span><span>{field.max}</span></div>
      </div>
    );
  }
  return null;
}
