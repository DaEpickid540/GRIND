import { useState, useRef, useEffect } from "react";
import { callAI, getAIConfig, getModelInfo, PROVIDERS } from "../lib/aiProvider";
import { useToast } from "../components/Toast";
import { useAuth } from "../hooks/useAuth";
import { saveNutritionEntry, getNutritionLog, updateUserProfile } from "../lib/firebase";
import { buildSystemPrompt } from "../lib/coachVoice";
import { buildKnowledgeContext } from "../lib/knowledgeBase";

// ── helpers ─────────────────────────────────────────────────────────────────
function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

function getActiveRestrictions(permanent = [], temps = []) {
  const today = new Date().toISOString().split("T")[0];
  return [
    ...permanent,
    ...temps.filter(r => r.until >= today).map(r => r.text),
  ];
}

// ── shared banner: warns when the selected model can't do vision ────────────
function VisionOnlyBanner() {
  const cfg = getAIConfig();
  if (!cfg?.provider) return null;
  const actualModel = cfg.model || PROVIDERS[cfg.provider]?.defaultModel;
  if (!actualModel) return null;
  const info = getModelInfo(actualModel);
  if (info.vision !== false) return null;   // model supports vision — no warning needed
  return (
    <div className="vision-only-banner">
      <span className="vision-only-icon">👁️</span>
      <div>
        <strong>Vision model required for photo scanning</strong>
        <span style={{ display:"block", fontSize:12, color:"#FF9800", marginTop:2 }}>
          "{info.label}" can't analyze images. Go to <strong>Settings → AI</strong> and
          switch to a vision-capable model (e.g. Gemini 2.0 Flash, GPT-4o, Claude Sonnet).
        </span>
      </div>
    </div>
  );
}

// ── Tab 1: Calorie Scanner ───────────────────────────────────────────────────
function CalorieScanner({ user }) {
  const toast    = useToast();
  const [image,    setImage]    = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const [log,      setLog]      = useState([]);
  const fileRef = useRef();
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    getNutritionLog(user.uid, today).then(entries =>
      setLog(entries.map(e => ({ ...e, time: e.time || "" })))
    );
  }, [user]);

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast("Image too large (max 8 MB)", "warning"); return; }
    const reader = new FileReader();
    reader.onload = ev => { setPreview(ev.target.result); setImage(file); setResult(null); };
    reader.readAsDataURL(file);
  }

  async function scan() {
    if (!image || scanning) return;
    setScanning(true);
    try {
      const b64    = preview.split(",")[1];
      const system = await buildSystemPrompt("nutrition", user?.uid, null);
      const text   = await callAI({
        system,
        userMessage: "Estimate the macros for this meal. Be real about whether this fits the user's goal.",
        imageBase64: b64, imageMime: image.type || "image/jpeg", maxTokens: 600,
      });
      const parsed = parseAIJson(text);
      setResult(parsed);
      const entry = { ...parsed, time: new Date().toLocaleTimeString(), date: today };
      setLog(l => [entry, ...l].slice(0, 20));
      if (user) await saveNutritionEntry(user.uid, entry);
      toast(`Scanned: ${parsed.meal} — ${parsed.calories} cal`, "success");
    } catch (e) {
      if (e.message === "NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Scan failed — try again", "error");
      console.error(e);
    } finally { setScanning(false); }
  }

  const totals = log.reduce(
    (a, i) => ({ cal: a.cal+(i.calories||0), protein: a.protein+(i.protein||0), carbs: a.carbs+(i.carbs||0), fat: a.fat+(i.fat||0) }),
    { cal:0, protein:0, carbs:0, fat:0 }
  );

  return (
    <div>
      <VisionOnlyBanner />
      <div className="nutrition-layout">
        <div className="nutrition-left">
          <div className="upload-zone" onClick={() => fileRef.current.click()}>
            {preview
              ? <img src={preview} alt="meal" style={{ width:"100%",height:"100%",objectFit:"cover",borderRadius:10 }}/>
              : <><div style={{ fontSize:48 }}>📸</div><p>Click to upload meal photo</p></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>
          <button className="btn-primary" onClick={scan} disabled={!image||scanning} style={{ marginTop:12 }}>
            {scanning ? "🔍 Scanning…" : "Scan Meal"}
          </button>
          {result && (
            <div className="macro-result">
              <h3>{result.meal}</h3>
              <div className="macro-grid">
                {[["Calories",result.calories,"#FF4D4D"],["Protein",`${result.protein}g`,"#4DC9FF"],["Carbs",`${result.carbs}g`,"#FFD700"],["Fat",`${result.fat}g`,"#00FF88"]].map(([k,v,c])=>(
                  <div key={k} className="macro-tile" style={{ borderColor:c }}><div className="macro-val" style={{ color:c }}>{v}</div><div className="macro-key">{k}</div></div>
                ))}
              </div>
              {result.items?.length>0 && (
                <div className="food-items">
                  {result.items.map((item,i) => (
                    <div key={i} className="food-item">
                      <span>{item.name}</span>
                      <span style={{ color:"#FFD700" }}>{item.calories} cal</span>
                      <span style={{ color:"#4DC9FF" }}>{item.protein}g P</span>
                    </div>
                  ))}
                </div>
              )}
              {result.tip && <div className="nutrition-tip">💡 {result.tip}</div>}
            </div>
          )}
        </div>

        <div className="nutrition-right">
          <div className="daily-summary">
            <h3>Today's Total</h3>
            <div className="daily-macros">
              {[["cal",totals.cal,"#FF4D4D"],["protein",`${totals.protein}g`,"#4DC9FF"],["carbs",`${totals.carbs}g`,"#FFD700"],["fat",`${totals.fat}g`,"#00FF88"]].map(([k,v,c])=>(
                <div key={k}><span className="dm-val" style={{ color:c }}>{v}</span><span className="dm-key">{k}</span></div>
              ))}
            </div>
          </div>
          <h4 style={{ color:"#666",fontSize:12,textTransform:"uppercase",letterSpacing:1,margin:"20px 0 10px" }}>Meal Log</h4>
          {log.length===0 && <p style={{ color:"#444",fontSize:14 }}>No meals scanned yet.</p>}
          {log.map((item,i) => (
            <div key={i} className="log-entry">
              <div style={{ fontWeight:600,fontSize:14 }}>{item.meal}</div>
              <div style={{ fontSize:12,color:"#666" }}>{item.time}</div>
              <div style={{ fontSize:12,color:"#FFD700" }}>{item.calories} cal · {item.protein}g P · {item.carbs}g C · {item.fat}g F</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Meal Plan Generator ──────────────────────────────────────────────
function MealPlan({ user, profile }) {
  const toast    = useToast();
  const [days,          setDays]          = useState(1);
  const [calorieTarget, setCalorieTarget] = useState("");
  const [cuisineNote,   setCuisineNote]   = useState("");
  const [plan,          setPlan]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [expanded,      setExpanded]      = useState({});

  const permanent   = profile?.dietaryRestrictions || [];
  const temps       = profile?.tempRestrictions    || [];
  const activeRest  = getActiveRestrictions(permanent, temps);

  async function generate() {
    if (loading) return;
    setLoading(true);
    try {
      const restStr  = activeRest.length > 0
        ? `Dietary restrictions/requirements (strictly follow these): ${activeRest.join(", ")}.`
        : "No dietary restrictions.";
      const calStr   = calorieTarget ? `Daily calorie target: approximately ${calorieTarget} kcal.` : "";
      const cuStr    = cuisineNote ? `Cuisine/style preference: ${cuisineNote}.` : "";

      const userMessage = `Generate a ${days}-day meal plan. ${restStr} ${calStr} ${cuStr}

Return ONLY valid JSON in this exact structure — no other text:
{
  "days": [
    {
      "day": "Day 1",
      "meals": [
        { "type": "Breakfast", "name": "...", "calories": 350, "protein": 20, "carbs": 40, "fat": 10, "desc": "One sentence description" },
        { "type": "Lunch",     "name": "...", "calories": 500, "protein": 35, "carbs": 50, "fat": 15, "desc": "..." },
        { "type": "Dinner",    "name": "...", "calories": 600, "protein": 40, "carbs": 55, "fat": 20, "desc": "..." },
        { "type": "Snack",     "name": "...", "calories": 200, "protein": 10, "carbs": 25, "fat":  5, "desc": "..." }
      ],
      "totalCalories": 1650,
      "totalProtein": 105,
      "totalCarbs": 170,
      "totalFat": 50
    }
  ],
  "summary": "2-3 sentences on what makes this plan suitable."
}`;

      const knowledge = buildKnowledgeContext("mealPlan");
      const system = [
        "You are a precise sports nutritionist and meal planner. Output only valid JSON, no markdown fencing outside the object.",
        knowledge,
      ].filter(Boolean).join("\n\n");

      const text = await callAI({
        system,
        userMessage,
        maxTokens: days <= 1 ? 1400 : days <= 3 ? 2400 : 4000,
      });

      const parsed = parseAIJson(text);
      setPlan(parsed);
      setExpanded({ 0: true });
      toast("Meal plan ready! 🍽️", "success");
    } catch (e) {
      if (e.message === "NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Generation failed — try again", "error");
      console.error(e);
    } finally { setLoading(false); }
  }

  return (
    <div className="meal-plan-section">
      {/* Active restrictions reminder */}
      {activeRest.length > 0 && (
        <div className="mp-restrictions-bar">
          <span className="mp-rest-label">🚫 Active restrictions:</span>
          <div className="mp-rest-chips">
            {activeRest.map((r, i) => <span key={i} className="mp-rest-chip">{r}</span>)}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mp-controls card">
        <div className="mp-control-row">
          <div className="mp-control-group">
            <label className="mp-label">Plan length</label>
            <div className="mp-day-btns">
              {[1, 3, 7].map(d => (
                <button key={d} className={`mp-day-btn${days===d?" active":""}`} onClick={() => setDays(d)}>
                  {d===1 ? "1 Day" : `${d} Days`}
                </button>
              ))}
            </div>
          </div>
          <div className="mp-control-group">
            <label className="mp-label">Daily calorie target <span style={{ color:"#555" }}>(optional)</span></label>
            <input
              className="mp-input"
              type="number"
              placeholder="e.g. 2000 kcal"
              value={calorieTarget}
              onChange={e => setCalorieTarget(e.target.value)}
            />
          </div>
        </div>
        <div className="mp-control-group" style={{ marginTop:12 }}>
          <label className="mp-label">Cuisine / style <span style={{ color:"#555" }}>(optional)</span></label>
          <input
            className="mp-input"
            type="text"
            placeholder="e.g. Mediterranean, high-protein, Indian vegetarian, keto…"
            value={cuisineNote}
            onChange={e => setCuisineNote(e.target.value)}
          />
        </div>
        <button
          className="btn-primary mp-generate-btn"
          onClick={generate}
          disabled={loading}
        >
          {loading
            ? "⏳ Generating…"
            : `✨ Generate ${days===1 ? "Day" : `${days}-Day`} Meal Plan`}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="loading-card" style={{ marginTop:20 }}>
          <div className="spinner"/>
          <p>Building your meal plan…</p>
        </div>
      )}

      {/* Plan display */}
      {!loading && plan && (
        <div className="mp-plan">
          {plan.summary && <div className="mp-summary">💬 {plan.summary}</div>}
          {plan.days?.map((day, di) => (
            <div key={di} className="mp-day-card">
              <button
                className="mp-day-header"
                onClick={() => setExpanded(e => ({ ...e, [di]: !e[di] }))}
              >
                <span className="mp-day-title">{day.day}</span>
                <div className="mp-day-totals">
                  <span style={{ color:"#FF4D4D" }}>{day.totalCalories} cal</span>
                  <span style={{ color:"#4DC9FF" }}>{day.totalProtein}g P</span>
                  <span style={{ color:"#FFD700" }}>{day.totalCarbs}g C</span>
                  <span style={{ color:"#00FF88" }}>{day.totalFat}g F</span>
                </div>
                <span className="mp-day-chevron">{expanded[di] ? "▲" : "▼"}</span>
              </button>
              {expanded[di] && (
                <div className="mp-meals">
                  {day.meals?.map((meal, mi) => (
                    <div key={mi} className="mp-meal-row">
                      <span className="mp-meal-type">{meal.type}</span>
                      <div className="mp-meal-info">
                        <div className="mp-meal-name">{meal.name}</div>
                        {meal.desc && <div className="mp-meal-desc">{meal.desc}</div>}
                        <div className="mp-meal-macros">
                          <span style={{ color:"#FF4D4D" }}>{meal.calories} cal</span>
                          <span style={{ color:"#4DC9FF" }}>{meal.protein}g P</span>
                          <span style={{ color:"#FFD700" }}>{meal.carbs}g C</span>
                          <span style={{ color:"#00FF88" }}>{meal.fat}g F</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !plan && (
        <div className="empty-state-card" style={{ marginTop:20 }}>
          <p style={{ color:"#555" }}>
            Set your preferences above and hit Generate — the AI will build a full meal plan
            that respects all your active dietary restrictions automatically.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Dietary Restrictions ─────────────────────────────────────────────
function Restrictions({ user, profile }) {
  const toast = useToast();
  const [permInput, setPermInput] = useState("");
  const [tempText,  setTempText]  = useState("");
  const [tempUntil, setTempUntil] = useState("");
  const [saving,    setSaving]    = useState(false);

  const permanent = profile?.dietaryRestrictions || [];
  const temps     = profile?.tempRestrictions    || [];
  const today     = new Date().toISOString().split("T")[0];
  const activeTemps  = temps.filter(r => r.until >= today);
  const expiredTemps = temps.filter(r => r.until <  today);

  async function save(patch) {
    if (!user) return;
    setSaving(true);
    try { await updateUserProfile(user.uid, patch); }
    finally { setSaving(false); }
  }

  async function addPermanent() {
    const v = permInput.trim(); if (!v) return;
    if (permanent.map(x=>x.toLowerCase()).includes(v.toLowerCase())) {
      toast("Already in your restrictions", "warning"); return;
    }
    await save({ dietaryRestrictions: [...permanent, v] });
    setPermInput("");
    toast(`Added: ${v}`, "success");
  }

  async function removePermanent(item) {
    await save({ dietaryRestrictions: permanent.filter(r => r !== item) });
  }

  async function addTemp() {
    const v = tempText.trim();
    if (!v || !tempUntil) { toast("Enter both a restriction and an end date", "warning"); return; }
    if (tempUntil < today) { toast("End date must be today or later", "warning"); return; }
    await save({ tempRestrictions: [...temps, { text: v, until: tempUntil }] });
    setTempText(""); setTempUntil("");
    toast(`Restriction active until ${tempUntil}`, "success");
  }

  async function removeTemp(r) {
    await save({ tempRestrictions: temps.filter(t => !(t.text===r.text && t.until===r.until)) });
  }

  async function clearExpired() {
    await save({ tempRestrictions: activeTemps });
    toast("Expired restrictions cleared", "success");
  }

  return (
    <div className="restrictions-section">
      {/* ── Permanent ── */}
      <div className="rest-card">
        <div className="rest-card-header">
          <h3 className="rest-card-title">🚫 Permanent Restrictions</h3>
          <p className="rest-card-sub">
            Allergies, intolerances, lifestyle choices — always applied to meal plans
          </p>
        </div>
        <div className="rest-add-row">
          <input
            className="rest-input"
            type="text"
            placeholder="e.g. peanut allergy, lactose intolerant, gluten-free, vegan, no pork…"
            value={permInput}
            onChange={e => setPermInput(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter") addPermanent(); }}
            maxLength={80}
          />
          <button className="rest-add-btn" onClick={addPermanent} disabled={saving || !permInput.trim()}>
            Add
          </button>
        </div>
        {permanent.length === 0
          ? <p className="rest-empty">No permanent restrictions yet.</p>
          : (
            <div className="rest-chips">
              {permanent.map((r, i) => (
                <div key={i} className="rest-chip perm">
                  <span>{r}</span>
                  <button className="rest-chip-remove" onClick={() => removePermanent(r)} title="Remove">✕</button>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* ── Temporary ── */}
      <div className="rest-card">
        <div className="rest-card-header">
          <h3 className="rest-card-title">⏳ Temporary Restrictions</h3>
          <p className="rest-card-sub">
            For festivals, events, or short-term diets — automatically expires on the set date
          </p>
        </div>

        {/* Example hints */}
        <div className="rest-examples">
          <span className="rest-example-label">Examples:</span>
          {["No meat (Ganpati / Navratri)", "No alcohol (dry month)", "Fasting — only fruits & nuts", "Low-carb challenge"].map((ex, i) => (
            <button key={i} className="rest-example-chip" onClick={() => setTempText(ex)}>{ex}</button>
          ))}
        </div>

        <div className="rest-temp-form">
          <input
            className="rest-input"
            type="text"
            placeholder="e.g. No meat, No eggs, Only sattvic food…"
            value={tempText}
            onChange={e => setTempText(e.target.value)}
            maxLength={80}
          />
          <div className="rest-date-row">
            <label className="rest-date-label">Active until:</label>
            <input
              className="rest-date-input"
              type="date"
              min={today}
              value={tempUntil}
              onChange={e => setTempUntil(e.target.value)}
            />
            <button
              className="rest-add-btn"
              onClick={addTemp}
              disabled={saving || !tempText.trim() || !tempUntil}
            >
              Add
            </button>
          </div>
        </div>

        {activeTemps.length === 0 && expiredTemps.length === 0 && (
          <p className="rest-empty">No temporary restrictions set.</p>
        )}

        {activeTemps.length > 0 && (
          <div className="rest-chips" style={{ marginTop:12 }}>
            {activeTemps.map((r, i) => {
              const msLeft   = new Date(r.until) - new Date(today);
              const daysLeft = Math.ceil(msLeft / 86400000);
              return (
                <div key={i} className="rest-chip temp">
                  <span className="rest-chip-text">{r.text}</span>
                  <span className="rest-chip-until">until {r.until} · {daysLeft}d left</span>
                  <button className="rest-chip-remove" onClick={() => removeTemp(r)} title="Remove">✕</button>
                </div>
              );
            })}
          </div>
        )}

        {expiredTemps.length > 0 && (
          <div style={{ marginTop:14 }}>
            <p className="rest-expired-label">Expired ({expiredTemps.length}):</p>
            <div className="rest-chips">
              {expiredTemps.map((r, i) => (
                <div key={i} className="rest-chip expired">
                  <span>{r.text}</span>
                  <span className="rest-chip-until">expired {r.until}</span>
                  <button className="rest-chip-remove" onClick={() => removeTemp(r)} title="Remove">✕</button>
                </div>
              ))}
            </div>
            <button className="rest-clear-expired" onClick={clearExpired}>
              Clear all expired
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"scanner",      label:"📸 Calorie Scanner", badge:"👁 Vision only" },
  { id:"mealplan",     label:"🍽️ Meal Plans"                              },
  { id:"restrictions", label:"🚫 Restrictions"                            },
];

export default function Nutrition() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState("scanner");

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">🥗 Nutrition</h1>
          <p className="page-sub">Track meals, generate AI plans, manage dietary restrictions</p>
        </div>
      </div>

      <div className="nutrition-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nutrition-tab${tab===t.id?" active":""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge && <span className="nutrition-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "scanner"      && <CalorieScanner user={user} profile={profile} />}
      {tab === "mealplan"     && <MealPlan       user={user} profile={profile} />}
      {tab === "restrictions" && <Restrictions   user={user} profile={profile} />}
    </div>
  );
}
