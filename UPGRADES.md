# GRIND — Upgrade Audit
**Audited:** 2026-06-03  
**Scope:** All files in `src/`, `public/`, `firestore.rules`, `vite.config.js`, `package.json`

---

## HIGH PRIORITY

### 🔴 Security

**H1 — `src/lib/aiProvider.js:168-177` — `testKey()` overwrites active config and never restores it**  
`testKey()` calls `saveAIConfig(tmpCfg)` so `callAI` picks up the test key. If the test fails, the user's original working key is already gone and never restored. A test on a bad key silently deletes the real key.  
**Fix:** Save the existing config before the test (`const prev = getAIConfig()`), restore it in the `finally` block regardless of outcome.

**H2 — `src/lib/firebase.js:339-342` — `genJoinCode()` uses `Math.random()` (not crypto-safe)**  
Class join codes are generated with `Math.random()`, which is seeded and not cryptographically random. An attacker who can observe timing could predict codes.  
**Fix:** Replace with `crypto.getRandomValues(new Uint8Array(6))` mapped to the safe-character alphabet.

**H3 — `firestore.rules` — All authenticated users can read all user documents**  
`allow read: if request.auth != null` on `/users/{uid}` exposes FCM tokens, excuses, streak data, and private fields to every logged-in user. Only leaderboard fields should be public.  
**Fix:** Split into a `public` subcollection with safe fields, or use granular field rules. At minimum, restrict reads to `request.auth.uid == uid || resource.data.uid in request.auth.token` for non-leaderboard queries.

**H4 — `firestore.rules:challenges` — Create rule allows injecting another user as sender**  
The create rule checks `request.auth.uid in request.resource.data.participants` but doesn't verify `request.resource.data.from == request.auth.uid`. Any user could craft a challenge that looks like it came from someone else.  
**Fix:** Add `&& request.resource.data.from == request.auth.uid` to the challenge create rule.

**H5 — `src/pages/AIScans.jsx` — No file size limit before sending to AI API**  
`Nutrition.jsx` has a 5MB guard on profile photo upload, but `AIScans.jsx` has no size check. A 20MB image gets base64-encoded and sent to the AI API, causing timeouts and burning tokens.  
**Fix:** Add `if (file.size > 8 * 1024 * 1024) { toast("Image too large (max 8MB)", "warning"); return; }` in the `handleFile` function.

---

### 🔴 Critical Bugs

**H6 — `src/pages/Widgets.jsx:82` — `useState` used as `useEffect` — install listener never fires**  
```js
useState(() => {           // ← WRONG: this is an initializer, runs once synchronously
  window.addEventListener("beforeinstallprompt", ...)
}, []);                    // ← dependency array is silently ignored
```
The `beforeinstallprompt` event listener is added synchronously at render time rather than in a proper side-effect. If the event fires before this render (it often does), it's missed. `setInstalled(true)` is also never reliably reached.  
**Fix:** Change to `useEffect(() => { ... }, [])`.

**H7 — `src/lib/firebase.js:364-384` — `joinClassByCode` increments `memberCount` even on re-join**  
`setDoc` on the member subdoc is idempotent, but `memberCount` is always incremented. If a student joins the same class twice (e.g., navigates back), the count goes to 2 with only one member.  
**Fix:** Check if member doc already exists before setting it and incrementing the count.

**H8 — `src/pages/GymRecords.jsx:15-22` — Gym records stored as Firestore array, will hit 1MB document limit**  
All records live in `users/{uid}.gymRecords` array inside the user document. Firestore documents max out at 1MB. An active user logging 3+ sets/day will hit this in ~6 months and all gym writes will silently fail.  
**Fix:** Migrate to a `users/{uid}/gymRecords/{id}` subcollection, same pattern as `checkins` and `skills`. Update `addGymRecord` in `firebase.js` and the read in `GymRecords.jsx`.

**H9 — `src/pages/Dashboard.jsx:40` — Keyboard shortcut handler captures stale `habits` / `handleSubmit`**  
The `useEffect` deps array is `[checkedIn, habits]` but calls `handleSubmit()` which is defined in the same render scope. If `handleSubmit` is recreated (it is, every render), the effect doesn't re-register. It works accidentally but is a latent bug when any dep changes.  
**Fix:** Wrap `handleSubmit` in `useCallback` with its true dependencies, add it to the effect deps.

**H10 — `src/pages/WeeklyPlan.jsx:35` + `Nutrition.jsx:48` + `AIScans.jsx:47` — Fragile AI JSON parsing**  
All three pages parse AI output as `JSON.parse(text.replace(/```json|```/g,"").trim())`. If the AI adds a preamble sentence, trailing comment, or wraps in different markdown, the entire feature throws "Failed to generate plan/scan" with no useful error.  
**Fix:** Extract JSON robustly: `const match = text.match(/\{[\s\S]*\}/); JSON.parse(match?.[0] ?? text)` — finds the first `{` to last `}`.

---

### 🔴 Mobile Responsiveness

**H11 — `src/index.css:32` — Login page has no mobile breakpoint**  
`grid-template-columns: 1fr 1fr` renders two columns at all screen widths. On a phone the left branding panel and right card are crammed side by side, each under 180px wide.  
**Fix:**
```css
@media (max-width: 768px) {
  .login-page { grid-template-columns: 1fr; }
  .login-left { display: none; }   /* or stack below */
}
```

**H12 — No mobile sidebar — the 240px sidebar is always visible**  
On screens under ~900px the sidebar takes 240px and the content area is too narrow to be usable. There is no hamburger menu, no drawer, no collapse mechanism.  
**Fix:** Add a hamburger button in the main area header on mobile. Sidebar becomes a drawer (fixed overlay) controlled by state. `--sidebar` should become `0` on mobile when closed.

**H13 — `src/index.css:105` — `checkin-bar` uses `left: var(--sidebar)`, breaks on mobile**  
The fixed check-in bar is positioned relative to the sidebar width. On mobile (when sidebar overlays content or is hidden), the bar is misaligned.  
**Fix:** The bar should use `left: 0` and `padding-left: calc(var(--sidebar) + 40px)` conditionally, or be reworked with a mobile-aware layout.

**H14 — `src/pages/Stats.jsx` — Charts and stat grid have no responsive CSS**  
`.charts-grid`, `.big-stats-row`, and `.levels-track` have no `@media` rules. On a 375px screen the 4-column stat cards overflow horizontally.  
**Fix:** Add responsive grid breakpoints: `@media (max-width: 600px) { .big-stats-row { grid-template-columns: repeat(2, 1fr); } .charts-grid { grid-template-columns: 1fr; } }`

---

### 🔴 Performance

**H15 — `src/pages/Stats.jsx:14` — Fetches all check-ins on every Stats visit, no pagination**  
A user with a year-long streak downloads 365+ Firestore documents every time Stats opens. No limit, no cache.  
**Fix:** Add `limit(180)` for the charts (6 months is plenty), or paginate with a "Load more" button.

**H16 — `src/App.jsx:59` — `hasCompletedOnboarding()` makes a Firestore read on every login**  
Called in a `useEffect` on `user` change. Every auth state change (page refresh, token refresh) fires a Firestore read to `/users/{uid}/private/onboarding`. For an active user this is wasteful.  
**Fix:** Cache the result in localStorage after first confirmation: `localStorage.setItem('grind_onboarded', '1')` and check that first before hitting Firestore.

**H17 — `src/pages/Friends.jsx:85-96` — Challenge auto-resolution fires on every real-time snapshot**  
Inside `watchMyChallenges`, every Firestore snapshot update loops through all challenges and fires `resolveChallenge()` for any expired ones. If 3 users are active, this fires 3× per check-in. It will also try to resolve challenges it already resolved on the previous snapshot.  
**Fix:** Check `c.status === "active"` AND the resolve write is idempotent already, but still: track a local Set of `resolvedIds` so you only call `resolveChallenge` once per challenge per session.

---

## MEDIUM PRIORITY

### 🟡 UX / Features

**M1 — `src/lib/userSettings.js` + `src/components/SettingsModal.jsx` — Data export never implemented**  
`DEFAULT_SETTINGS` has `exportFormat: "json"` and the Settings modal has a "Data" tab, but there is no export button or implementation.  
**Fix:** In the Data tab, add a button that calls a function to fetch all user data (profile, checkins, skills, gym records) and downloads it as JSON/CSV based on the setting.

**M2 — `src/pages/GymRecords.jsx` — No delete functionality for individual records**  
Once a gym record is logged it can never be removed. Users who mis-log weight/reps are stuck with bad data affecting their PR calculations.  
**Fix:** Add a trash icon on each history row. Call `updateDoc` with `arrayRemove` (once migrated to subcollection: `deleteDoc`).

**M3 — `src/pages/GymRecords.jsx` — Weight always in lbs, no kg toggle**  
International users track in kg. The form placeholder says "lbs" and all PRs show "lbs" hardcoded.  
**Fix:** Add a `weightUnit` setting (default "lbs"). Convert display in the PR card and history. Store all weights in a canonical unit (lbs) and convert on display.

**M4 — `src/pages/Skills.jsx` — Delete skill is imported but never exposed in the UI**  
`deleteSkill` is imported from `firebase.js` but there's no delete button anywhere in the Skills UI. Users can't remove skills they no longer track.  
**Fix:** Add a trash button in the skill detail panel header (with confirmation).

**M5 — `src/pages/Leaderboard.jsx` — No time-period filter (this week / this month / all time)**  
The leaderboard only shows all-time XP totals. A user who joined last week can never compete with someone who's been using it for months. Weekly XP comparison would be much more engaging.  
**Fix:** Store a `weeklyXP` field on user documents (reset each Monday via a Cloud Function, or calculate from check-in history client-side).

**M6 — `src/pages/Leaderboard.jsx` — No rank shown for users outside top 50**  
`watchLeaderboard` fetches 50. If there are 200 users, anyone ranked 51+ has no way to know their rank.  
**Fix:** After fetching the board, check if `user.uid` is in the result. If not, do a separate count query to determine rank and show it below the table.

**M7 — `src/pages/Dashboard.jsx:31` — `today` doesn't update if tab stays open past midnight**  
`today` is computed once at component mount time. If a user leaves the tab open overnight, the next morning it still shows yesterday's date and check-in state is wrong.  
**Fix:** Use a custom `useToday()` hook that subscribes to a daily timer (check every minute if the date changed).

**M8 — `src/pages/Breathing.jsx` — "+5 XP" promised in toast is never actually awarded**  
The breathing completion toast says `"🎉 Breathing session complete! +5 XP"` but there is no call to `submitCheckIn`, `updateUserProfile`, or any XP-granting function. It's fake UI feedback.  
**Fix:** Either remove the "+5 XP" claim, or call `updateUserProfile(uid, { xp: profile.xp + 5 })` and `refreshProfile()` on session complete.

**M9 — `src/pages/Dashboard.jsx` — No undo for accidental check-in**  
Once submitted, the check-in cannot be reversed until tomorrow. A mis-click locks the user in.  
**Fix:** For 60 seconds after submission, show an "Undo" button. On click, delete the check-in doc and revert XP/streak in the user document.

**M10 — `src/pages/Friends.jsx` — Challenges hardcoded to 7-day XP race**  
`sendChallenge` is called with `"7-day XP race", 7` hardcoded everywhere. No UI to pick duration or type.  
**Fix:** Show a small modal before sending: "Challenge type" (XP race / streak race) and "Duration" (3 / 7 / 14 / 30 days).

**M11 — `src/pages/AIScans.jsx` + `src/pages/Nutrition.jsx` — No drag-and-drop on upload zone**  
Both upload zones are click-only. Drag-and-drop is the natural gesture on desktop.  
**Fix:** Add `onDragOver`, `onDragLeave`, `onDrop` handlers to `.upload-zone`. Extract shared `<UploadZone>` component.

**M12 — `src/data/gameData.js:80-88` — Level system caps out at 10,000 XP ("GOAT")**  
After GOAT there's no progression. Power users hit max level in a few months and lose the motivational hook.  
**Fix:** Extend `LEVELS` array with post-GOAT tiers (Legend, Mythic, etc.), or add a prestige system that resets XP for a special badge.

---

### 🟡 Code Quality

**M13 — `src/pages/Stats.jsx:8` — `onViewProfile` prop passed by App.jsx but never used inside Stats**  
`App.jsx:113` passes `onViewProfile={uid => setPublicUID(uid)}` but `Stats.jsx` never calls it. Dead prop.  
**Fix:** Either wire up a "View Profile" link in Stats (e.g., on the avatar/name), or remove the prop from both files.

**M14 — `src/pages/Friends.jsx:309` — `toast` prop passed to `ChallengeCard` but not used**  
`ChallengeCard` accepts `toast` as a prop but the component doesn't call it anywhere.  
**Fix:** Remove the `toast` prop from `ChallengeCard`. It can import `useToast()` directly if ever needed.

**M15 — `src/components/Sidebar.jsx:25` — `getAIConfig()` called on every render**  
`getAIConfig()` reads from `localStorage` synchronously on every render of the sidebar. The sidebar re-renders on every navigation click.  
**Fix:** Move to `useState(() => getAIConfig())` and subscribe to a custom event when the config changes (or use a context/store for AI config).

**M16 — `src/pages/Classes.jsx:74,79` — Native `confirm()` for destructive actions**  
`confirm()` is a blocking browser dialog with no styling, blocked in sandboxed iframes, and broken in some mobile browsers.  
**Fix:** Replace with a custom confirmation modal (reuse `.modal-overlay` / `.modal` pattern already in the codebase).

**M17 — `src/lib/reminders.js:59` — `window.__grindToast` global is an anti-pattern**  
The reminder system sets `window.__grindToast` as a global so non-React code can call into React's toast system.  
**Fix:** Use a proper event emitter: `window.dispatchEvent(new CustomEvent('grind:toast', { detail: { msg, type } }))` and listen in `ToastProvider` with `window.addEventListener('grind:toast', ...)`.

**M18 — `src/pages/Skills.jsx:63` — Race condition in `loadSessions` on rapid skill selection**  
If the user clicks skill A then immediately skill B, two async fetches race. The first (A) might resolve after the second (B), overwriting sessions with the wrong skill's data.  
**Fix:** Use an `AbortController` or a ref-based "current skill ID" check: ignore results that don't match the currently selected skill when they resolve.

**M19 — `src/hooks/useAuth.jsx` — `onAuth` listener not type-guarded; profile fetch has no error handling**  
If `getOrCreateUser` throws (e.g., Firestore offline), `setUser` is never called and the app stays on the splash screen forever.  
**Fix:** Wrap the `onAuth` callback body in `try/catch`. On error, still call `setUser(fu)` so the auth state is correct even if the profile fetch fails.

**M20 — Multiple files — XP math done in two places with different formulas**  
`Dashboard.jsx:58-64` computes `liveXP` by iterating habits. `firebase.js:63-65` computes `xpGained` the same way. If the formula ever changes, it must be updated in both places and can drift.  
**Fix:** Extract `computeHabitXP(habitsDoneMap, habitCategories)` into `gameData.js` and call it from both places.

---

### 🟡 Accessibility

**M21 — No `:focus-visible` styles — keyboard navigation shows no focus ring**  
Every `button`, `input`, `select`, and `a` element uses `outline: none` implicitly or via the CSS reset. Keyboard-only users see no focus indicator.  
**Fix:** Add globally:
```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

**M22 — `src/components/Toast.jsx` — Toasts not announced to screen readers**  
The toast container has no `role="alert"` or `aria-live` attribute. Screen reader users don't hear notifications.  
**Fix:** Add `role="status" aria-live="polite" aria-atomic="true"` to `.toast-container`, or `role="alert"` for error/warning toasts.

**M23 — Icon-only buttons lack accessible labels**  
- `src/pages/Friends.jsx:56` — `⚔️` challenge button has only a `title` attribute (not read by all screen readers)  
- `src/components/Sidebar.jsx:100` — settings `⚙️` and logout buttons have no `aria-label`  
- `src/pages/Skills.jsx` — rating star buttons have no accessible text  
**Fix:** Add `aria-label="Challenge [name]"`, `aria-label="Open settings"`, etc.

**M24 — `var(--muted)` (#555 on #080808) fails WCAG AA contrast**  
Contrast ratio ≈ 2.7:1. WCAG AA requires 4.5:1 for normal text and 3:1 for large text. Used widely: `.sidebar-xp-label`, `.ring-label`, `.page-sub`, and many inline `color:"#555"` styles.  
**Fix:** Darken `--muted` to `#777` minimum (3.7:1), or increase background color of affected elements.

**M25 — `src/pages/AIScans.jsx:115` + `Nutrition.jsx:69` — Upload zone not keyboard-accessible**  
`.upload-zone` is a `<div onClick>` with no `role`, `tabIndex`, or keyboard handler. Keyboard-only users can't trigger the file picker.  
**Fix:** Add `role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileRef.current.click()}`.

---

## LOW PRIORITY

### 🟢 UX Polish

**L1 — `src/pages/Dashboard.jsx` — No partial check-in for "hard mode"**  
`DEFAULT_SETTINGS.hardMode` exists in `userSettings.js` and the Setting modal has a toggle for it (requires all habits for check-in to count), but `Dashboard.jsx` never reads `hardMode` or applies the restriction.  
**Fix:** In `handleSubmit`, check `getSettings().hardMode`. If true and `done < total`, show a warning toast and block submission.

**L2 — `src/pages/Stats.jsx` — No skill stats on the Stats page**  
The Stats page shows XP, streak, check-in history, and category radar — but Skills (which have their own XP, levels, and session data) are completely absent.  
**Fix:** Add a "Skills" section to Stats with top 3 skills by XP, total hours logged, and a combined practice heatmap.

**L3 — `src/pages/GymRecords.jsx` — No strength progression chart**  
PRs tab shows best-ever lifts, but there's no chart showing bench/squat/deadlift trend over time. This is the most requested feature in gym tracking apps.  
**Fix:** In PRs tab, add a line chart (recharts, already bundled) for the selected exercise's 1RM over time.

**L4 — `src/pages/Leaderboard.jsx:67` — `p.customPhotoURL||p.photoURL` checks customPhoto on wrong field**  
The leaderboard reads `p.customPhotoURL` directly from the user document. But `customPhotoURL` is set by `uploadProfilePhoto` in `firebase.js:181`. The issue is the `img` tag says `src={p.customPhotoURL||p.photoURL}` — if `p.customPhotoURL` is undefined, it falls back correctly. Minor: no alt text.  
**Fix:** Add `alt={p.displayName || ""}` to prevent screen reader noise.

**L5 — `src/pages/Widgets.jsx:104` — `pct` for Today's Widget is always 0**  
`const pct = 0; // Would be today's progress, shown as 0 for preview`. The widget preview always shows 0% even if the user has checked in habits today.  
**Fix:** Read today's completed habits from a hook or pass them in. Dashboard already computes `pct` — this could be a shared context value.

**L6 — `src/lib/userSettings.js` — `streakGracePeriod` setting is never applied**  
`DEFAULT_SETTINGS` defines `streakGracePeriod: 0` (extra hours before streak breaks). The sidebar's `streakAtRisk` calculation and `submitCheckIn` both ignore this setting entirely.  
**Fix:** In `firebase.js:submitCheckIn`, when calculating whether to reset the streak, add grace period hours to the "yesterday" threshold.

**L7 — `public/sw.js` — Service worker only caches index.html, all assets fail offline**  
The `install` handler caches only `["/", "/index.html"]`. The JS/CSS/font assets are not precached. The `fetch` handler falls back to cache on network error, but the cache has nothing useful. The app is effectively not offline-capable.  
**Fix:** Use Vite's `vite-plugin-pwa` (or manually list the hashed asset filenames) to precache all generated assets. This gives true offline support.

**L8 — `src/App.jsx` — No URL routing; browser back/forward doesn't work**  
All navigation is state-based (`setPage`). Opening a shared link (`?profile=`) works but pressing the back button doesn't navigate to the previous page — it goes back in browser history, which is a different URL.  
**Fix:** Use `window.history.pushState` on `setPage`, or introduce React Router v6 (very lightweight) for proper URL-based routing.

**L9 — `src/components/OnboardingModal.jsx` — No ability to re-do onboarding from Settings**  
Once completed, the onboarding profile is locked behind the Firebase `private/onboarding` doc. Users can only view it if the Settings modal builds a UI for it. There's no "Update my profile" entry point.  
**Fix:** Add a "Update AI Profile" button in Settings → Profile tab that re-opens the onboarding modal (skipping the first-time gating logic).

**L10 — `src/index.css:1` — Fonts loaded from Google Fonts (no fallback, no preload)**  
Three font families are loaded from `fonts.googleapis.com` with no `<link rel="preload">` and no fallback font stack for the custom fonts. On slow connections, text is invisible (FOIT) until fonts load.  
**Fix:**
```html
<!-- in index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```
Add system fallbacks: `font-family: 'Syne', system-ui, sans-serif`.

---

### 🟢 Code Quality

**L11 — `src/pages/Dashboard.jsx:52-64` — `liveXP` recalculated inline on every render**  
`liveXP` iterates all habits on every render. With the current ~21 habits this is trivially fast, but it's an `O(n)` computation inside the render path.  
**Fix:** `const liveXP = useMemo(() => ..., [habits])`.

**L12 — Multiple files — Inline style objects created on every render**  
Components like `Dashboard.jsx`, `Stats.jsx`, and `Friends.jsx` have hundreds of inline `style={{ fontSize:13, color:"#888" }}` objects that are new references each render, triggering unnecessary child re-renders.  
**Fix:** Extract repeated styles to CSS classes. Inline styles are fine for dynamic values (colors from data), but static ones should be classes.

**L13 — `src/pages/Friends.jsx:286-307` — `RequestCard` fetches profile on every mount with no cache**  
Each `RequestCard` independently calls `getUserProfile(req.from)` on mount. If there are 5 pending requests from the same UID (unusual but possible), it fires 5 reads. More realistically, every re-render of the Requests tab re-mounts and re-fetches.  
**Fix:** Memoize with `useEffect` + a ref, or fetch all required profiles in the parent `Friends` component once.

**L14 — `src/lib/firebase.js` — `deleteClass` leaves orphaned member subcollection docs**  
The comment in the code acknowledges this: `// members subcollection will become orphaned`. Firestore doesn't cascade-delete subcollections. Orphaned members accumulate and are billable reads.  
**Fix:** Add a Cloud Function (`functions/index.js` is already set up) that triggers on `classes/{classId}` delete and recursively deletes the members subcollection.

**L15 — `vite.config.js:12` — `advancedChunks` is deprecated in Vite 8**  
Build output shows: `WARN advancedChunks option is deprecated, please use codeSplitting instead`.  
**Fix:**
```js
build: {
  codeSplitting: {
    strategy: 'balanced',
  }
}
```
Or use manual `rollupOptions.output.manualChunks` which is the standard Vite/Rollup API.

---

## Summary Count
| Priority | Issues |
|----------|--------|
| High     | 17     |
| Medium   | 20     |
| Low      | 15     |
| **Total**| **52** |

## Highest-Impact Quick Wins (do these first)
1. **H1** — Fix `testKey()` destroying the existing API key (5-line fix)
2. **H6** — Fix `useState` → `useEffect` in Widgets.jsx (1-line fix)
3. **H8** — Plan migration of gymRecords from array to subcollection (prevents data loss)
4. **H10** — Robust JSON extraction from AI responses (5-line fix, fixes 3 features)
5. **H11 + H12** — Mobile CSS + sidebar collapse (biggest UX impact for phone users)
6. **M8** — Remove fake "+5 XP" from Breathing toast (honesty fix)
7. **M21** — Add `:focus-visible` styles globally (1-line CSS fix, full a11y win)
