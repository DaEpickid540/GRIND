import { useState, useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./components/Toast";
import { hasValidKey } from "./lib/aiProvider";
import { applySettings, getSettings } from "./lib/userSettings";
import { hasCompletedOnboarding } from "./lib/firebase";
import { initReminders, ensurePermission } from "./lib/reminders";
import Sidebar from "./components/Sidebar";

// Eager: tiny + needed immediately on load
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Lazy: each becomes its own chunk, loaded only when navigated to.
// This keeps heavy deps (recharts, zxing, qrcode, firebase storage/messaging)
// out of the initial bundle.
const WeeklyPlan    = lazy(() => import("./pages/WeeklyPlan"));
const GymRecords    = lazy(() => import("./pages/GymRecords"));
const Nutrition     = lazy(() => import("./pages/Nutrition"));
const AIScans       = lazy(() => import("./pages/AIScans"));
const Breathing     = lazy(() => import("./pages/Breathing"));
const Leaderboard   = lazy(() => import("./pages/Leaderboard"));
const Stats         = lazy(() => import("./pages/Stats"));        // pulls recharts
const Skills        = lazy(() => import("./pages/Skills"));
const Friends       = lazy(() => import("./pages/Friends"));      // pulls zxing + qrcode
const Widgets       = lazy(() => import("./pages/Widgets"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));// pulls qrcode
const Classes       = lazy(() => import("./pages/Classes"));
const Tutorial      = lazy(() => import("./pages/Tutorial"));

// Lazy modals — only load when opened
const SettingsModal    = lazy(() => import("./components/SettingsModal"));
const APIKeyModal      = lazy(() => import("./components/APIKeyModal"));
const OnboardingModal  = lazy(() => import("./components/OnboardingModal"));

function PageLoader() {
  return (
    <div className="page-content">
      <div className="loading-card">
        <div className="spinner"/>
        <p>Loading…</p>
      </div>
    </div>
  );
}

function AppInner() {
  const { user } = useAuth();
  const [page,            setPage]            = useState("dashboard");
  const [needsKey,        setNeedsKey]        = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [publicUID,       setPublicUID]       = useState(null);

  useEffect(() => {
    if (user) {
      setNeedsKey(!hasValidKey());
      applySettings(getSettings());
      hasCompletedOnboarding(user.uid).then(done => setNeedsOnboarding(!done));
      initReminders();
    }
    const params = new URLSearchParams(window.location.search);
    const profUID = params.get("profile");
    if (profUID) { setPublicUID(profUID); window.history.replaceState({},""," "); }
  }, [user]);

  useEffect(() => {
    const handler = e => {
      if ((e.metaKey||e.ctrlKey) && e.key===",") { e.preventDefault(); if (user) setShowSettings(s=>!s); }
      if (e.key==="Escape" && showSettings) setShowSettings(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [user, showSettings]);

  if (user===undefined) return <div className="splash"><div className="splash-bolt">⚡</div><div className="splash-word">GRIND</div></div>;
  if (!user) return <Login/>;

  // Public profile overlay
  if (publicUID) return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} onOpenSettings={() => setShowSettings(true)}/>
      <main className="main-area">
        <Suspense fallback={<PageLoader/>}>
          <PublicProfile uid={publicUID} onBack={() => setPublicUID(null)}/>
        </Suspense>
      </main>
    </div>
  );

  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        {needsKey && <APIKeyModal onDone={() => setNeedsKey(false)} onShowTutorial={() => { setNeedsKey(false); setPage("tutorial"); }}/>}
        {!needsKey && needsOnboarding && <OnboardingModal onDone={() => setNeedsOnboarding(false)}/>}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onResetKey={() => { setShowSettings(false); setNeedsKey(true); }}/>}
      </Suspense>
      <Sidebar page={page} setPage={setPage} onOpenSettings={() => setShowSettings(true)}/>
      <main className="main-area">
        <Suspense fallback={<PageLoader/>}>
          {page==="dashboard"   && <Dashboard/>}
          {page==="plan"        && <WeeklyPlan/>}
          {page==="skills"      && <Skills/>}
          {page==="gym"         && <GymRecords/>}
          {page==="nutrition"   && <Nutrition/>}
          {page==="ai_scan"     && <AIScans/>}
          {page==="breathing"   && <Breathing/>}
          {page==="friends"     && <Friends/>}
          {page==="leaderboard" && <Leaderboard/>}
          {page==="classes"     && <Classes/>}
          {page==="widgets"     && <Widgets/>}
          {page==="tutorial"    && <Tutorial/>}
          {page==="stats"       && <Stats onViewProfile={uid => setPublicUID(uid)}/>}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider><ToastProvider><AppInner/></ToastProvider></AuthProvider>
  );
}
