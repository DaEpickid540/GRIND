# ⚡ GRIND

> Turn your life into a game. Win it every day.

A full-stack self-improvement web app with habit tracking, skill leveling, gym records, AI-powered weekly plans, nutrition scanning, body analysis, breathing exercises, QR-based friend system, leaderboards, and PWA home screen support.

Built by **Sarvin** — see [Credits & Licensing](#-credits--licensing) below.

---

## 📸 Features

| Page | What it does |
|------|-------------|
| 🧬 **Onboarding** | First-run flow collects ~25 profile data points (goals, sport, weight, struggles + a freeform "Anything else?" box) so the AI knows who it's coaching |
| ⚡ **Today** | Daily habit check-in across 5 categories with Apple Watch–style completion rings, XP system, streaks, and excuse protection |
| 📋 **Weekly Plan** | AI generates a full 7-day Morning/Afternoon/Evening structured schedule, personalized to your profile |
| 🎯 **Skills** | Create and level up any skill (guitar, basketball, coding...), log sessions, track practice heatmap |
| 🏋️ **Gym Records** | Log sets, auto-calc estimated 1RM (Epley formula), PR board per exercise |
| 🥗 **Nutrition** | Snap a meal photo → AI estimates calories + macros per item, in bro-coach voice |
| 📸 **AI Scans** | Outfit rating, physique analysis, posture correction — all vision-powered, all personalized |
| 🌬️ **Breathing** | Box breathing, 4-7-8, belly breathing with animated ring and cycle tracking |
| 👥 **Friends** | Add friends via QR code or link, view their streaks, send challenges |
| 🎓 **Classes** | Teacher/coach system — create a class, share a join code, see student progress on a live roster |
| 🏆 **Leaderboard** | Real-time XP rankings with live challenge buttons (global + friends scope) |
| 📊 **Stats** | XP over time, habit completion charts, radar chart, full level journey |
| 📱 **Home Screen** | PWA install guide + widget previews |
| 📖 **Setup Guide** | Step-by-step tutorial for getting a free or paid AI key (Groq, Gemini, OpenRouter, Anthropic, DeepSeek, OpenAI) |
| ⚙️ **Settings** | 8-tab modal: AI provider, profile editor, appearance, habits, gamification, notifications + health reminders, data export, account |

**AI Voice:** Every AI feature uses a unified "bro + coach + friend" voice that references your actual onboarding data (goals, sport, struggles, diet, etc.) so feedback feels personal, not generic.

**Health Reminders:** In-session toasts and notifications for water, posture, stretching, eye breaks (20/20/20), movement, and breathing. Configurable intervals per reminder.

---

## 🚀 Hosting Guide

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Firebase](https://console.firebase.google.com/) account (free)
- A [Google account](https://accounts.google.com/) for Firebase Auth

---

### Step 1 — Clone and Install

```bash
git clone https://github.com/yourusername/grind-app.git
cd grind-app
npm install
```

Or if you downloaded the zip:

```bash
unzip grind-app-v6.zip -d grind-app
cd grind-app
npm install
```

---

### Step 2 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **"Add project"** → give it a name (e.g. `grind-app`) → Continue
3. Disable Google Analytics if you don't need it → **Create project**

#### Enable Google Authentication

1. In the Firebase console, go to **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in providers**, click **Google** → Enable → add your support email → **Save**

#### Enable Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (you'll lock it down later) → **Next**
4. Pick a region closest to you → **Enable**

#### Get Your Firebase Config

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **"Your apps"** → click **"</>"** (Web app)
3. Register the app with a nickname → **Register app**
4. Copy the `firebaseConfig` object — you'll need these values

---

### Step 3 — Configure Environment Variables

Copy the example env file:

```bash
cp .env.example .env
```

Open `.env` and fill in your Firebase values:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> ⚠️ Never commit your `.env` file. It's already in `.gitignore`.

---

### Step 4 — Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Sign in with Google — you'll be prompted to add an AI API key on first launch.

---

### Step 5 — Add an AI API Key (In-App)

GRIND uses AI for Weekly Plans, Nutrition Scanner, and AI Scans. The app supports 4 providers — pick whichever you want:

| Provider | Free Tier | Get Key |
|----------|-----------|---------|
| 🟠 Anthropic | No | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| 🔵 Google Gemini | ✅ 15 req/min | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| ⚡ Groq | ✅ Very generous | [console.groq.com](https://console.groq.com/keys) |
| 🔀 OpenRouter | ✅ Many free models | [openrouter.ai/keys](https://openrouter.ai/keys) |

Your key is stored in **localStorage only** — it never touches Firebase or any server.

---

### Step 6 — Deploy to Firebase Hosting (Free)

This is the easiest way to get a live URL.

#### Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

#### Initialize Hosting

```bash
firebase init hosting
```

When prompted:
- **Which Firebase project?** → select your project
- **What do you want to use as your public directory?** → type `dist`
- **Configure as a single-page app?** → `Yes`
- **Set up automatic builds with GitHub?** → `No` (for now)
- **Overwrite dist/index.html?** → `No`

#### Build and Deploy

```bash
npm run build
firebase deploy --only hosting
```

Firebase will give you a live URL like `https://your-project.web.app` 🎉

---

### Alternative: Deploy to Vercel

```bash
npm install -g vercel
npm run build
vercel --prod
```

Set your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

### Alternative: Deploy to Netlify

1. Run `npm run build`
2. Drag the `dist/` folder into [app.netlify.com/drop](https://app.netlify.com/drop)
3. Done. For env vars, go to **Site Settings → Environment Variables**

For proper SPA routing on Netlify, create `public/_redirects`:

```
/*    /index.html   200
```

---

### Step 7 — Lock Down Firestore Rules (Production)

Once you're ready to go live, replace the default test rules in Firebase Console → **Firestore → Rules**:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;

      match /checkins/{date} {
        allow read, write: if request.auth.uid == userId;
      }
      match /private/{doc} {
        // Onboarding profile + other private user data
        allow read, write: if request.auth.uid == userId;
      }
      match /nutrition/{entryId} {
        allow read, write: if request.auth.uid == userId;
      }
      match /scans/{scanId} {
        allow read, write: if request.auth.uid == userId;
      }
      match /skills/{skillId} {
        allow read: if request.auth != null;
        allow write: if request.auth.uid == userId;
        match /sessions/{sessionId} {
          allow read, write: if request.auth.uid == userId;
        }
      }
    }

    // Leaderboard — anyone logged in can read
    match /users/{userId} {
      allow read: if request.auth != null;
    }

    // Friend requests
    match /friendRequests/{reqId} {
      allow read: if request.auth.uid == resource.data.from
                  || request.auth.uid == resource.data.to;
      allow create: if request.auth.uid == request.resource.data.from;
      allow update: if request.auth.uid == resource.data.to;
    }

    // Challenges
    match /challenges/{challengeId} {
      allow read, write: if request.auth != null;
    }

    // Classes — teacher owns; students can read class info + member docs
    match /classes/{classId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.teacherUid;
      allow update, delete: if request.auth.uid == resource.data.teacherUid;

      match /members/{memberUid} {
        // Anyone in the class can read the roster
        allow read: if request.auth != null;
        // A user can write only their own member doc; teacher can do anything
        allow write: if request.auth.uid == memberUid
                     || request.auth.uid == get(/databases/$(database)/documents/classes/$(classId)).data.teacherUid;
      }
    }
  }
}
```

---

### Step 8 — Custom Domain (Optional)

In Firebase Hosting → **Add custom domain** → follow the DNS instructions. Takes ~24 hours for DNS propagation.

---

## 🔧 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite 8 |
| Styling | Pure CSS (custom design system) |
| Auth | Firebase Authentication (Google) |
| Database | Firebase Firestore |
| Hosting | Firebase Hosting (or Vercel/Netlify) |
| AI | Anthropic / Gemini / Groq / OpenRouter (user's own key) |
| Charts | Recharts |
| QR Codes | qrcode (npm) |
| PWA | Service Worker + Web Manifest |

---

## 📁 Project Structure

```
grind-app/
├── public/
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
├── src/
│   ├── components/
│   │   ├── APIKeyModal.jsx     # Forced first-run AI key setup
│   │   ├── Confetti.jsx        # Canvas confetti for milestones
│   │   ├── SettingsModal.jsx   # 7-tab settings modal
│   │   ├── Sidebar.jsx         # Desktop navigation
│   │   └── Toast.jsx           # Global notification system
│   ├── data/
│   │   └── gameData.js         # Habits, levels, XP, excuses
│   ├── hooks/
│   │   └── useAuth.jsx         # Firebase auth context
│   ├── lib/
│   │   ├── aiProvider.js       # Multi-provider AI abstraction
│   │   ├── firebase.js         # All Firestore operations
│   │   └── userSettings.js     # LocalStorage settings manager
│   ├── pages/
│   │   ├── AIScans.jsx         # Outfit / physique / posture scans
│   │   ├── Breathing.jsx       # Guided breathing exercises
│   │   ├── Dashboard.jsx       # Daily habit check-in
│   │   ├── Friends.jsx         # QR friend system
│   │   ├── GymRecords.jsx      # Lift tracking + PRs
│   │   ├── Leaderboard.jsx     # Global XP board
│   │   ├── Login.jsx           # Google auth landing
│   │   ├── Nutrition.jsx       # Meal photo → macros
│   │   ├── PublicProfile.jsx   # Shareable profile page
│   │   ├── Skills.jsx          # Skill leveling + heatmap
│   │   ├── Stats.jsx           # Charts and analytics
│   │   ├── WeeklyPlan.jsx      # AI-generated daily schedule
│   │   └── Widgets.jsx         # PWA install + widget previews
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

---

## ✅ Is the App Complete?

The core app is fully functional and deployable. Here's an honest breakdown:

### What's Done ✅
- Full habit tracking with XP, streaks, excuses, and completion rings
- Skill leveling system with session logs and practice heatmaps
- Gym PR tracker with 1RM estimation
- AI Weekly Plans (7-day structured schedule)
- AI Nutrition Scanner (meal photo → macros)
- AI Scans: outfit rating, physique analysis, posture correction
- Guided breathing exercises with fixed phase loop
- QR code friend system with camera scanning and friend requests
- Global leaderboard with challenge system
- Public shareable profile pages with QR share
- Full settings modal (7 tabs: AI, appearance, habits, gamification, notifications, data, account)
- Multi-provider AI (Anthropic, Gemini, Groq, OpenRouter)
- PWA manifest + service worker (installable on phone)
- Confetti + toast notifications
- Data export (full JSON dump)
- XP reset / danger zone

### What's Still Rough / Known Limitations 🔧
- **Push notifications require deploying Cloud Functions** — the code is in `functions/` and fully wired (FCM tokens, scheduled hourly checks, reminder times saved to Firestore). You just need to run `firebase deploy --only functions` and set your VAPID key. Also edit `public/firebase-messaging-sw.js` with your config.
- **Firestore composite indexes** — the friends/challenges queries (`where` + `array-contains`) may need indexes the first time they run. Firebase prints a direct "create index" link in the browser console — just click it.
- **FCM web push** doesn't work on iOS Safari unless the app is installed as a PWA first (Apple limitation, not the app's).

### Fixed in This Version ✅
- ✅ Real-time leaderboard (`onSnapshot`) — updates live, with Global/Friends scope toggle
- ✅ Real-time friend requests — appear instantly without refresh
- ✅ Full challenge flow — send, accept, decline, live XP tracking, auto-resolve at deadline, winner calculation, history
- ✅ Cross-browser QR scanning — swapped BarcodeDetector for `@zxing/library` (works in Safari/Firefox/Chrome)
- ✅ Nutrition results persist to Firestore — today's meal log reloads on return
- ✅ AI Scan results persist — past scans show as a clickable history strip
- ✅ Profile photo upload — via Firebase Storage, used everywhere avatars appear
- ✅ Push notification infrastructure — Cloud Function + client FCM token registration + reminder prefs

### Production Deployment Checklist 🚀
1. Deploy Cloud Functions: `cd functions && npm install && cd .. && firebase deploy --only functions`
2. Set VAPID key in `.env` (Console → Cloud Messaging → Web Push certificates)
3. Edit `public/firebase-messaging-sw.js` with your Firebase config
4. Enable Firebase Storage (Console → Storage → Get started) for profile photos
5. Apply Firestore security rules (template in Step 7)
6. Click any "create index" links Firebase shows you in the console on first query

---

## 💳 Credits & Licensing

**Original author: Sarvin**

This project is open for personal use, modification, and self-hosting.

**If you fork, modify, or redistribute this project, you must include the following in your README:**

```
Originally built by Sarvin.
https://github.com/yourusername/grind-app
```

That's it. No other restrictions — use it, break it, make it better. Just give credit where it's due.

---

## 🛠️ Local Dev Commands

```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Build for production → dist/
npm run preview  # Preview production build locally
```

---

## 🔑 Environment Variables Reference

| Variable | Where to find it |
|----------|-----------------|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same |
| `VITE_FIREBASE_PROJECT_ID` | Same |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `VITE_FIREBASE_APP_ID` | Same |

AI keys are **not** environment variables — they're entered by each user in the app's Settings modal and stored in their browser's localStorage.

---

*Built with React, Firebase, and a lot of ⚡*

---

## ☁️ Deploying Cloud Functions (Push Notifications)

The streak reminder push notifications run on a scheduled Cloud Function.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

This deploys `streakReminder`, which runs every hour and sends a push to any user who:
- Has notifications enabled
- Hasn't checked in today
- Has no active excuse
- Has their reminder hour matching the current hour

> Cloud Functions require the Firebase **Blaze (pay-as-you-go)** plan, but the free tier covers ~2M invocations/month — an hourly function is well within free limits.

### Firebase Storage Rules

For profile photo uploads, set these rules in Console → **Storage → Rules**:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profilePhotos/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```
