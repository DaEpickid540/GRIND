// Curated knowledge base — grounds AI features in real fitness/nutrition/
// body-composition facts instead of letting the model freelance from memory.
//
// This is a deliberately simplified take on RAG: a hand-curated, tagged,
// WEIGHTED fact library that gets scored + spliced into prompts as a
// grounding block. True vector-embedding RAG (chunking, embeddings, a vector
// store, similarity search) is too heavy for a client-only Firebase SPA —
// this gets ~80% of the grounding benefit with zero infrastructure.
//
// The "weights" are real and functional, not cosmetic:
//   - Each fact ships with a base importance weight (1-10).
//   - Each CATEGORY has a user-tunable multiplier (0 = off, 1 = normal, 2 = emphasized)
//     stored in localStorage — this is the "model weights" knob the user asked for.
//   - Users can ALSO add their own custom facts with their own category + weight,
//     which compete for the same slots as the curated ones — a simple but real
//     mirror of "adding additional weights" to a retrieval system.
//
// Final score = baseWeight × categoryMultiplier. Top-N per feature get spliced
// into the system prompt. Nothing here is sent anywhere — it's pure local
// grounding text injected client-side into the prompt GRIND already builds.

export const KB_CATEGORIES = {
  nutrition: { label: "Nutrition & Meals",    emoji: "🍽️", desc: "Meal strategies for different goals — bulking, cutting, performance, recovery, vegetarian/vegan." },
  training:  { label: "Training & Workouts",  emoji: "🏋️", desc: "What actually makes a workout effective — programming, exercise selection, cardio, mobility." },
  bodyComp:  { label: "Body Composition",     emoji: "⚖️", desc: "How fat loss & muscle gain really work — energy balance, metabolism, realistic rates of change." },
  recovery:  { label: "Recovery & Lifestyle", emoji: "😴", desc: "Sleep, stress, hydration — the stuff outside the gym that makes or breaks results." },
  mindset:   { label: "Mindset & Habits",     emoji: "🧠", desc: "Behavior science — what actually makes habits and motivation stick long-term." },
};

export const KNOWLEDGE_BASE = [
  // ── Nutrition: meals for different purposes ──────────────────────────────
  { id:"nut-bulk", category:"nutrition", weight:6, tags:["bulk","muscle gain","mass gain","weight gain","surplus","gain weight"],
    fact:"Lean bulking works best with a modest ~250-500 kcal/day surplus and roughly 0.7-1g of protein per lb of bodyweight — bigger surpluses mostly pile on fat, not muscle, since muscle protein synthesis has a ceiling regardless of how much extra you eat." },
  { id:"nut-cut", category:"nutrition", weight:6, tags:["cut","cutting","fat loss","weight loss","deficit","lean out","shred"],
    fact:"When cutting, keep protein HIGH (around 1g per lb of bodyweight or even a bit more) — it preserves muscle in a deficit and is the most filling macro, which makes the deficit far more bearable. Pair it with high-volume, high-fiber foods (vegetables, fruit, legumes) to stay full on fewer calories." },
  { id:"nut-pre-workout", category:"nutrition", weight:5, tags:["pre-workout","fuel","energy","before training","performance meal"],
    fact:"A solid pre-workout meal 1-3 hours out is mostly carbs with a moderate amount of protein and low fat/fiber (which slow digestion) — think rice + chicken, oats + fruit, or toast + eggs. Eating too close to training or too heavy leads to sluggishness and cramping." },
  { id:"nut-post-workout", category:"nutrition", weight:5, tags:["post-workout","recovery meal","after training","protein timing"],
    fact:"Post-workout, prioritize protein + carbs within a few hours (the so-called 'anabolic window' is wider than people think — it's hours, not minutes). Carbs replenish glycogen, protein kickstarts repair. A simple combo like a protein shake + banana or chicken + rice covers both." },
  { id:"nut-veg-protein", category:"nutrition", weight:5, tags:["vegetarian","vegan","plant-based","protein sources","no meat"],
    fact:"Plant-based eaters can absolutely hit protein targets — combine sources across the day (legumes, tofu/tempeh, seitan, quinoa, Greek-style yogurt alternatives, edamame, lentils) rather than relying on one. Total daily protein matters more than 'complete protein per meal' — that's an outdated worry for anyone eating a varied diet." },
  { id:"nut-endurance", category:"nutrition", weight:4, tags:["endurance","running","cardio fuel","carb loading","long workouts","hydration electrolytes"],
    fact:"For endurance work over ~75 minutes, carb intake and hydration with electrolytes (sodium especially) become the limiting factor, not willpower. Practice fueling in training, not just on race day — the gut adapts to handling food during exertion just like muscles adapt to load." },
  { id:"nut-quick-meals", category:"nutrition", weight:4, tags:["quick meals","busy","time crunch","budget","meal prep","easy"],
    fact:"The best diet is the one you'll actually stick to on a busy week — lean on a small rotation of 4-5 simple, protein-forward meals you can make on autopilot (eggs + toast, rice bowls, wraps, sheet-pan chicken + veggies) rather than chasing complicated recipes that fall apart the moment life gets hectic." },
  { id:"nut-evening", category:"nutrition", weight:3, tags:["sleep","evening meal","late night eating","dinner","digestion"],
    fact:"Heavy, greasy, or very spicy meals close to bedtime can disrupt sleep via reflux and a spiked core temperature. A lighter dinner with some carbs and foods containing tryptophan (turkey, dairy alternatives, nuts, seeds) tends to support better sleep than a late, heavy feast." },
  { id:"nut-hydration", category:"nutrition", weight:3, tags:["water","hydration","thirst","performance"],
    fact:"Even mild dehydration (around 2% of bodyweight in fluid loss) measurably hurts strength, endurance, and focus. A simple gut check: pale yellow urine and rarely feeling thirsty means you're roughly on track — dark urine and constant thirst means you're behind." },

  // ── Training: good workout activities ────────────────────────────────────
  { id:"train-compound", category:"training", weight:6, tags:["strength","compound lifts","squat","deadlift","bench","barbell","powerlifting"],
    fact:"Compound lifts (squat, deadlift, bench press, overhead press, rows) train multiple muscle groups at once and give the most strength and muscle 'per minute' invested — they should anchor most general strength programs, with isolation work (curls, lateral raises, etc.) layered in to address weak points." },
  { id:"train-hypertrophy", category:"training", weight:6, tags:["hypertrophy","build muscle","muscle growth","reps","volume","progressive overload"],
    fact:"Muscle growth responds mainly to progressive overload (gradually doing more weight, reps, or sets over time) within roughly the 6-20 rep range taken close to failure — there's no single 'magic' rep range; consistency and steadily increasing the challenge matter far more than the exact number." },
  { id:"train-cardio-types", category:"training", weight:5, tags:["cardio","hiit","liss","running","conditioning","fat loss cardio"],
    fact:"LISS (steady, lower-intensity cardio like brisk walking or easy cycling) is easy to recover from and great for building an aerobic base and burning extra calories without wrecking other training. HIIT (short, hard intervals) is time-efficient and boosts conditioning fast, but is much more fatiguing — it should be programmed sparingly, not daily." },
  { id:"train-mobility", category:"training", weight:4, tags:["mobility","flexibility","warmup","stretching","injury prevention"],
    fact:"A few minutes of dynamic warmup (leg swings, arm circles, bodyweight squats, light cardio) before training primes the joints and nervous system far better than static stretching cold. Save longer static stretching and mobility work for after training or as its own session — it improves range of motion better when muscles are already warm." },
  { id:"train-beginner", category:"training", weight:5, tags:["beginner","new to lifting","starting out","first program","novice"],
    fact:"Beginners make the fastest progress on simple full-body programs trained 3x/week with a handful of compound lifts — the goal early on is building the *habit* and movement skill, not finding the 'perfect' split. Complexity can wait until basic consistency is locked in." },
  { id:"train-sport-specific", category:"training", weight:4, tags:["sport","athlete","explosiveness","agility","power","conditioning for sport"],
    fact:"For sport performance, general strength is the base but power (force × speed) and sport-specific conditioning win games — think jumps, sprints, change-of-direction drills, and medicine ball throws layered on top of a strength foundation, matched to the actual demands of the sport/position." },
  { id:"train-deload", category:"training", weight:4, tags:["deload","overtraining","plateau","fatigue","rest week"],
    fact:"Strength and energy plateaus, nagging joint aches, and dreading workouts you used to enjoy are classic signs accumulated fatigue has caught up. A planned 'deload' week (roughly half the usual volume/intensity) every 4-8 weeks lets the body absorb the training and often leads to a rebound in performance right after." },
  { id:"train-home", category:"training", weight:3, tags:["home workout","no equipment","bodyweight","minimal gear","apartment"],
    fact:"Bodyweight training (push-ups, pull-ups, squats, lunges, dips, planks, nordic curls) can build real strength and muscle, especially for beginners to intermediates — manipulating leverage, tempo, and reps creates plenty of progressive overload without a single piece of equipment." },

  // ── Body composition: how thin/fat actually work ────────────────────────
  { id:"body-energy-balance", category:"bodyComp", weight:7, tags:["calories","energy balance","tdee","bmr","weight gain","weight loss","how fat works"],
    fact:"At the most basic level, body weight change tracks energy balance: eat more energy than you burn (TDEE — total daily energy expenditure) and you store the surplus, mostly as fat; eat less and the body draws on stored energy to make up the gap. Hormones, sleep, stress, and food choices all matter — but they mainly work BY shifting how much you eat or burn, not by bypassing this balance entirely." },
  { id:"body-spot-reduction", category:"bodyComp", weight:6, tags:["spot reduction","belly fat","stubborn fat","target fat loss","abs"],
    fact:"You cannot choose where your body loses fat from by training that area — 'spot reduction' (e.g., endless crunches for belly fat) is a myth. Fat loss happens systemically based on genetics and hormones; the area someone 'loses last' is usually just where they tend to store the most." },
  { id:"body-recomposition", category:"bodyComp", weight:6, tags:["body recomposition","scale weight","muscle vs fat","weight vs body fat","plateau"],
    fact:"The scale can lie: someone can gain muscle and lose fat at the same time ('body recomposition'), especially as a beginner or when returning from time off — meaning their weight stays flat while they look and perform noticeably better. Progress photos, measurements, and how clothes fit often tell a truer story than the number on the scale." },
  { id:"body-adaptation", category:"bodyComp", weight:5, tags:["metabolic adaptation","plateau","weight loss stall","adaptive thermogenesis","starvation mode"],
    fact:"As someone loses weight, their body burns somewhat fewer calories at rest and during activity ('metabolic adaptation') — a smaller body simply costs less energy to run, and hormones nudge hunger up. This is normal, not 'a broken metabolism,' and is the main reason deficits often need to be re-adjusted (or a maintenance break taken) as progress continues." },
  { id:"body-neat", category:"bodyComp", weight:4, tags:["neat","daily movement","steps","non-exercise activity","sedentary"],
    fact:"NEAT (Non-Exercise Activity Thermogenesis — fidgeting, walking, taking stairs, standing, chores) often accounts for MORE day-to-day calorie variation than a planned workout. Someone who walks 10,000 steps and stays generally active throughout the day can out-burn a person who crushes one intense session and then sits still for 16 hours." },
  { id:"body-hormones-sleep", category:"bodyComp", weight:5, tags:["hormones","cortisol","insulin","sleep and weight","stress and fat"],
    fact:"Poor sleep and chronic stress raise cortisol and disrupt hunger hormones (ghrelin up, leptin down) — which is a big part of why sleep-deprived, stressed-out people tend to crave more food (especially energy-dense, palatable food) and find it harder to stick to a plan. Fixing sleep and stress is often a more leveraged move than tweaking macros further." },
  { id:"body-realistic-rates", category:"bodyComp", weight:6, tags:["realistic results","how fast","timeline","shredded","transformation","rate of progress"],
    fact:"Sustainable fat loss is roughly 0.5-1% of bodyweight per week, and meaningful natural muscle gain is measured in pounds per MONTH for beginners (and far slower for experienced lifters) — not days. 'Shredded in 2 weeks' content is almost always extreme water manipulation, lighting, or pure fantasy; setting realistic timelines is what keeps people consistent long enough to actually get results." },

  // ── Recovery & lifestyle ─────────────────────────────────────────────────
  { id:"rec-sleep", category:"recovery", weight:6, tags:["sleep","recovery","rest","performance","muscle repair"],
    fact:"Sleep is when most physical recovery and muscle repair actually happens — chronic short sleep (well under ~7 hours for most adults) measurably hurts strength, reaction time, fat-loss results, and mood. If someone is grinding hard but skimping on sleep, sleep is very often the highest-leverage fix available, ahead of any supplement or program tweak." },
  { id:"rec-stress", category:"recovery", weight:5, tags:["stress","cortisol","mental load","burnout","overtraining"],
    fact:"Physical training is itself a stressor, and it stacks on top of life stress (school, work, relationships). When total stress (training + life) outpaces recovery, performance drops and motivation craters — sometimes the right move isn't 'push harder,' it's 'recover better' (sleep, lighter training week, talking to someone, simply resting)." },
  { id:"rec-hydration-general", category:"recovery", weight:3, tags:["hydration","water intake","daily fluid","energy levels"],
    fact:"Mild dehydration is one of the most common, overlooked causes of low energy, headaches, and poor focus during the day — well before someone feels notably thirsty. Keeping water within reach and sipping throughout the day beats trying to chug a big amount all at once." },
  { id:"rec-active-recovery", category:"recovery", weight:3, tags:["active recovery","rest day","light movement","soreness","doms"],
    fact:"On rest days, light movement (a walk, easy bike ride, stretching, casual sport) often helps with soreness and feels better than total inactivity — it boosts blood flow to recovering muscles without adding meaningful fatigue. 'Rest' doesn't have to mean 'do nothing.'" },

  // ── Mindset & habits ─────────────────────────────────────────────────────
  { id:"mind-consistency", category:"mindset", weight:6, tags:["consistency","motivation","discipline","showing up","habits"],
    fact:"Consistency beats intensity almost every time — a mediocre plan followed consistently for months crushes a 'perfect' plan that gets abandoned after two weeks. The real skill to build isn't finding the optimal program; it's becoming the kind of person who shows up on the days they don't feel like it." },
  { id:"mind-habit-stacking", category:"mindset", weight:5, tags:["habit stacking","building habits","new habit","routine","triggers"],
    fact:"New habits stick far better when they're anchored to something already automatic ('habit stacking') — e.g., 'after I brush my teeth, I do 10 push-ups' — rather than relying on remembering or feeling motivated. The existing habit becomes the trigger, removing the need for willpower in the moment." },
  { id:"mind-motivation-vs-discipline", category:"mindset", weight:5, tags:["motivation","discipline","feeling unmotivated","low motivation","willpower"],
    fact:"Motivation is a feeling that comes and goes — counting on it to show up every day is a losing bet. Discipline (or really, just good systems and routines) is what carries someone through the days motivation doesn't show. The goal isn't to 'feel like it' every time; it's to make the right action the path of least resistance." },
  { id:"mind-identity", category:"mindset", weight:4, tags:["identity","self-image","becoming someone","mindset shift","who you want to be"],
    fact:"Habits stick longest when they're tied to identity rather than outcomes — 'I'm becoming someone who trains' sustains someone through plateaus far better than 'I need to lose 15 lbs by June.' Outcome goals are useful for direction; identity is what keeps someone going when the scale doesn't move on schedule." },
  { id:"mind-comparison", category:"mindset", weight:4, tags:["comparison","jealousy","social media","other people's progress","self-doubt"],
    fact:"Comparing day-30 of your journey to someone else's day-1000 highlight reel is one of the fastest ways to talk yourself out of progress that's actually real. The only fair comparison is against where someone started — and that comparison, tracked honestly over weeks and months, is almost always more encouraging than it feels in the moment." },
];

// ── Local config: per-category weight multipliers + user-added custom facts ─
const LS_KEY = "grind_kb_config";

export const DEFAULT_KB_CONFIG = {
  weights: {},      // { [categoryId]: multiplier } — default 1 if absent. 0 = off, 2 = emphasized
  customFacts: [],  // [{ id, category, tags:[], fact, weight }]
};

export function getKBConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_KB_CONFIG, weights:{}, customFacts:[] };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_KB_CONFIG,
      ...parsed,
      weights: { ...(parsed.weights || {}) },
      customFacts: Array.isArray(parsed.customFacts) ? parsed.customFacts : [],
    };
  } catch { return { ...DEFAULT_KB_CONFIG, weights:{}, customFacts:[] }; }
}

export function saveKBConfig(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

export function clearKBConfig() {
  localStorage.removeItem(LS_KEY);
}

export function getCategoryMultiplier(cfg, categoryId) {
  const w = cfg?.weights?.[categoryId];
  return typeof w === "number" && !Number.isNaN(w) ? w : 1;
}

export function setCategoryMultiplier(categoryId, multiplier) {
  const cfg = getKBConfig();
  const next = { ...cfg, weights: { ...cfg.weights, [categoryId]: multiplier } };
  saveKBConfig(next);
  return next;
}

export function addCustomFact({ category, tags = [], fact, weight = 5 }) {
  const cfg = getKBConfig();
  const entry = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: KB_CATEGORIES[category] ? category : "mindset",
    tags: Array.isArray(tags) ? tags : String(tags).split(",").map(t => t.trim()).filter(Boolean),
    fact: String(fact || "").trim(),
    weight: Math.max(1, Math.min(10, Number(weight) || 5)),
  };
  if (!entry.fact) return cfg;
  const next = { ...cfg, customFacts: [...cfg.customFacts, entry] };
  saveKBConfig(next);
  return next;
}

export function removeCustomFact(id) {
  const cfg = getKBConfig();
  const next = { ...cfg, customFacts: cfg.customFacts.filter(f => f.id !== id) };
  saveKBConfig(next);
  return next;
}

// Which knowledge categories are relevant to which AI feature — keeps the
// grounding focused instead of dumping the entire library into every prompt.
const FEATURE_CATEGORY_MAP = {
  nutrition:   ["nutrition", "bodyComp"],
  mealPlan:    ["nutrition", "bodyComp"],
  weeklyPlan:  ["training", "mindset", "recovery"],
  workoutPlan: ["training", "bodyComp", "recovery"],
  physique:    ["bodyComp", "training", "nutrition"],
  posture:     ["training", "recovery"],
  outfit:      [], // not relevant — style isn't in the KB, skip silently
  insights:    ["mindset", "bodyComp", "recovery"],
  chat:        ["nutrition", "training", "bodyComp", "recovery", "mindset"],
};

// Score + select the most relevant facts for a feature, then format as a
// grounding block ready to splice into a system prompt. Returns "" if the
// feature isn't mapped, every relevant category is zeroed out, or there's
// nothing to show — callers should treat this as optional, best-effort context.
export function buildKnowledgeContext(feature, { limit = 6 } = {}) {
  const cats = FEATURE_CATEGORY_MAP[feature];
  if (!cats || !cats.length) return "";

  const cfg = getKBConfig();
  const pool = [
    ...KNOWLEDGE_BASE,
    ...cfg.customFacts.map(f => ({ ...f, custom: true })),
  ];

  const scored = pool
    .filter(f => cats.includes(f.category))
    .map(f => ({ ...f, score: (Number(f.weight) || 5) * getCategoryMultiplier(cfg, f.category) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!scored.length) return "";

  const lines = scored.map((f, i) => {
    const cat = KB_CATEGORIES[f.category]?.label || f.category;
    const tag = f.custom ? " · user-added" : "";
    return `${i + 1}. [${cat}${tag}] ${f.fact}`;
  });

  return [
    "GROUNDING KNOWLEDGE (real facts to inform your answer — weave them in naturally where relevant, don't just list them back):",
    ...lines,
  ].join("\n");
}
