# GRIND — Deployment Log

## Found

No GRIND-specific zip was found anywhere on the PC (Downloads, Desktop, OneDrive, AppData).
The existing GRIND repo at `C:\Users\daepi\OneDrive\Pictures\Documents\GitHub\GRIND` already
contained all app files, last modified **2026-05-29**. This is the latest version — no
extraction needed.

Files confirmed present:
- `src/` — React app (Vite + JSX)
- `src/lib/firebase.js` — Firebase SDK integration
- `src/lib/aiProvider.js` — Multi-AI provider abstraction
- `src/pages/` — Login, Dashboard, Stats, Settings, Skills, Friends, etc.
- `src/components/` — Sidebar, SettingsModal, APIKeyModal, etc.
- `public/` — sw.js, firebase-messaging-sw.js, manifest.json
- `functions/` — Cloud Functions stub
- `package.json` — React 19, Vite 8, Firebase 12

---

## Extracted

N/A — no zip was found. App files were already in place from prior work (5/29/2026).

---

## Security

**Password audit performed: 2026-06-03**

### CLEAN — No plain-text password storage or transmission found.

**Auth method:** Google OAuth only via `firebase/auth` → `signInWithPopup`. There are no
passwords, no password fields, no email/password auth. Nothing to hash.

**AI API keys in localStorage:**
- Keys for Anthropic/Gemini/Groq/OpenRouter are stored in `localStorage` under
  `grind_ai_config`. This is intentional by design — the app explicitly discloses it
  to users: *"Keys are saved to your browser's localStorage and never leave your device."*
- Keys are sent directly from the user's browser to the respective AI provider APIs.
  They never touch any GRIND server.
- Risk: XSS attacks could read localStorage. Mitigation for future: use a server-side
  proxy so keys never need to be client-side. Flagged as low priority for this
  client-only architecture.

**Firebase config (.env):**
- All Firebase values sourced from `import.meta.env.VITE_*` env vars. No hardcoded
  credentials found anywhere in source.

**New files added:**
- `.env` — Firebase project config (not committed to git)
- `firestore.rules` — Firestore security rules enforcing auth-gated read/write

---

## Deploy

**Date:** 2026-06-03

**Firebase project:** `grind-site`

**Deployed:**
- Hosting: `dist/` (Vite production build, 33 files)
- Firestore security rules: compiled + released

**Live URLs:**
- https://grind-site.web.app
- https://grind-site.firebaseapp.com

**Firebase Console:**
- https://console.firebase.google.com/project/grind-site/overview

---

## Fixes Applied (2026-06-03 — session 2)

### Critical Bugs Fixed
- **H1** `aiProvider.js` — `testKey()` now saves/restores original config; failed test no longer destroys working key
- **H6** `Widgets.jsx` — Fixed `useState` → `useEffect` for PWA install listener; install button now works
- **H7** `firebase.js` — `joinClassByCode` guards against double-join; member count no longer increments on re-join
- **H8** `firebase.js` + `GymRecords.jsx` — Gym records migrated from user doc array → `gymRecords` subcollection; 1MB doc limit eliminated. Added delete button per record.
- **H10** `WeeklyPlan.jsx`, `Nutrition.jsx`, `AIScans.jsx` — Robust JSON extraction (`/\{[\s\S]*\}/` regex) replaces brittle `JSON.parse(text.replace(...))`. All three AI features now handle preamble text gracefully.

### Security
- **H2** `firebase.js` — `genJoinCode()` now uses `crypto.getRandomValues()` instead of `Math.random()`
- **H4** `firestore.rules` — Challenge create rule now enforces `from == request.auth.uid` to prevent sender spoofing
- **H5** `AIScans.jsx`, `Nutrition.jsx` — Added 8MB file size guard before sending to AI APIs

### Mobile
- **H11** `index.css` — Login page single-column on mobile; left branding panel hidden on small screens
- **H12** `App.jsx`, `Sidebar.jsx`, `index.css` — Full mobile sidebar drawer with hamburger button, overlay backdrop, and close button. All nav items close the drawer automatically.
- **H13** `index.css` — `checkin-bar` is `left: 0` on mobile (no longer offset by sidebar width)
- **H14** `index.css` — Stats page 2-column cards, single-column charts on mobile

### Performance
- **H16** `App.jsx` — Onboarding completion now cached in `localStorage`; eliminates redundant Firestore read on every login

### UX / Honesty
- **M8** `Breathing.jsx` — Removed fake "+5 XP" from completion toast (XP was never actually awarded)

### Accessibility
- **M21** `index.css` — Global `:focus-visible` ring added; keyboard users can now see focus state
- **M22** `Toast.jsx` — Toast container has `role="status" aria-live="polite"`; error/warning toasts get `role="alert"`
- **M24** `index.css` — `--muted` raised from `#555` to `#777` for better contrast ratio

### Code Quality
- **M13** `App.jsx` — Removed unused `onViewProfile` prop from `<Stats>`
- **M14** `Friends.jsx` — Removed unused `toast` prop from `ChallengeCard`
- **L15** `vite.config.js` — Fixed deprecated `advancedChunks` → `manualChunks` function (fixes build warning)

### Re-deployed
- `firebase deploy --project grind-site` — hosting + Firestore rules live at https://grind-site.web.app

## TODO / Still Open

### REQUIRED before the app works end-to-end:

1. **Enable Google Sign-In in Firebase Console**
   - Go to: https://console.firebase.google.com/project/grind-site/authentication/providers
   - Click "Google" → toggle Enabled → add your support email → Save
   - Add `grind-site.web.app` and `grind-site.firebaseapp.com` to the
     authorized domains list (Authentication → Settings → Authorized Domains)

2. **Enable Firebase Storage** (needed for profile photo uploads)
   - Go to: https://console.firebase.google.com/project/grind-site/storage
   - Click "Get started" → choose a region → Start in production mode

3. **Enable Firebase Cloud Messaging (optional — push notifications)**
   - Go to: https://console.firebase.google.com/project/grind-site/messaging
   - Generate a VAPID key pair under Web Push certificates
   - Paste the public key into `.env` as `VITE_FIREBASE_VAPID_KEY=...`
   - Run `npm run build && firebase deploy` again

4. **Add `.env` to `.gitignore`** (keep credentials out of git)
   ```
   echo ".env" >> .gitignore
   ```

5. **Future: backend AI proxy** — move AI API keys server-side (Cloud Functions) to
   eliminate localStorage key exposure risk.
