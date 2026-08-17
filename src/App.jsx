import { useState, useEffect, lazy, Suspense } from "react";
import { Menu } from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ToastProvider } from "./components/Toast";
import { hasValidKey } from "./lib/aiProvider";
import { applySettings, getSettings, saveSettings } from "./lib/userSettings";
import { hasCompletedOnboarding } from "./lib/firebase";
import { initReminders, ensurePermission } from "./lib/reminders";
import Sidebar from "./components/Sidebar";
import AISidebar, { AISidebarToggle } from "./components/AISidebar";
import InstallPrompt from "./components/InstallPrompt";
import MobileTopbar from "./components/MobileTopbar";

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
const VoiceCoach    = lazy(() => import("./pages/VoiceCoach"));
const Breathing     = lazy(() => import("./pages/Breathing"));
const Leaderboard   = lazy(() => import("./pages/Leaderboard"));
const Stats         = lazy(() => import("./pages/Stats"));        // pulls recharts
const Skills        = lazy(() => import("./pages/Skills"));
const Friends       = lazy(() => import("./pages/Friends"));      // pulls zxing + qrcode
const Widgets       = lazy(() => import("./pages/Widgets"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));// pulls qrcode
const Classes       = lazy(() => import("./pages/Classes"));
const Tutorial      = lazy(() => import("./pages/Tutorial"));
const Store         = lazy(() => import("./pages/Store"));

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
  const [settingsTab,     setSettingsTab]     = useState(null);
  const [publicUID,       setPublicUID]       = useState(null);
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [aiOpen,          setAiOpen]          = useState(false);

  useEffect(() => {
    if (user) {
      setNeedsKey(!hasValidKey());
      applySettings(getSettings());
      // Cache onboarding result in localStorage to avoid a Firestore read on every load
      const cached = localStorage.getItem("grind_onboarded");
      if (cached) {
        setNeedsOnboarding(false);
      } else {
        hasCompletedOnboarding(user.uid).then(done => {
          if (done) localStorage.setItem("grind_onboarded", "1");
          setNeedsOnboarding(!done);
        });
      }
      initReminders();
    }
    const params = new URLSearchParams(window.location.search);
    const profUID = params.get("profile");
    if (profUID) { setPublicUID(profUID); window.history.replaceState({},""," "); }
    // Manifest "shortcuts" (long-press app icon) link to /?page=<id>; routing is
    // plain React state rather than URL-based, so read the param once on boot
    // and clear it from the URL so it doesn't linger after normal navigation.
    const shortcutPage = params.get("page");
    if (shortcutPage) { setPage(shortcutPage); window.history.replaceState({},""," "); }
  }, [user]);

  useEffect(() => {
    const handler = e => {
      if ((e.metaKey||e.ctrlKey) && e.key===",") { e.preventDefault(); if (user) setShowSettings(s=>!s); }
      if (e.key==="Escape" && showSettings) setShowSettings(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [user, showSettings]);

  if (user===undefined) return <div className="splash"><img src="/favicon.svg" alt="" className="splash-bolt"/><div className="splash-word">GRIND</div></div>;
  if (!user) return <Login/>;

  const navTo = (p) => { setPage(p); setSidebarOpen(false); };
  const openSettings = (tab) => {
    setSettingsTab(typeof tab === "string" ? tab : null);
    setShowSettings(true);
    setSidebarOpen(false);
  };

  // Handed to the AI sidebar's action runner — the only way it can touch the
  // app. Deliberately just these three: navigation, opening settings, and
  // local appearance settings. Nothing here can delete, spend, or send.
  const aiHandlers = {
    navigate: navTo,
    openSettings,
    updateSetting: (k, v) => {
      const next = { ...getSettings(), [k]: v };
      saveSettings(next);
      applySettings(next);
    },
  };

  // Public profile overlay
  if (publicUID) return (
    <div className="app-shell">
      <Sidebar page={page} setPage={navTo} onOpenSettings={openSettings}
               isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}/>}
      <main className="main-area">
        <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
        <Suspense fallback={<PageLoader/>}>
          <PublicProfile uid={publicUID} onBack={() => setPublicUID(null)}/>
        </Suspense>
      </main>
    </div>
  );

  return (
    <div className={`app-shell${aiOpen ? " ai-open" : ""}`}>
      <Suspense fallback={null}>
        {needsKey && <APIKeyModal onDone={() => setNeedsKey(false)} onShowTutorial={() => { setNeedsKey(false); navTo("tutorial"); }}/>}
        {!needsKey && needsOnboarding && <OnboardingModal onDone={() => { setNeedsOnboarding(false); localStorage.setItem("grind_onboarded","1"); }}/>}
        {showSettings && <SettingsModal initialTab={settingsTab} onClose={() => setShowSettings(false)} onResetKey={() => { setShowSettings(false); setNeedsKey(true); }}/>}
      </Suspense>
      <Sidebar page={page} setPage={navTo} onOpenSettings={openSettings}
               isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}/>}
      <main className="main-area">
        <MobileTopbar onOpenSidebar={() => setSidebarOpen(true)} onOpenSettings={openSettings} onOpenAI={() => setAiOpen(true)}/>
        <Suspense fallback={<PageLoader/>}>
          {page==="dashboard"   && <Dashboard/>}
          {page==="plan"        && <WeeklyPlan/>}
          {page==="skills"      && <Skills/>}
          {page==="gym"         && <GymRecords/>}
          {page==="nutrition"   && <Nutrition/>}
          {page==="ai_scan"     && <AIScans/>}
          {page==="voice_coach" && <VoiceCoach/>}
          {page==="breathing"   && <Breathing/>}
          {page==="friends"     && <Friends/>}
          {page==="leaderboard" && <Leaderboard/>}
          {page==="classes"     && <Classes/>}
          {page==="store"       && <Store/>}
          {page==="widgets"     && <Widgets/>}
          {page==="tutorial"    && <Tutorial/>}
          {page==="stats"       && <Stats/>}
        </Suspense>
      </main>
      <AISidebarToggle open={aiOpen} onClick={() => setAiOpen(true)}/>
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} page={page} handlers={aiHandlers}/>
      <InstallPrompt/>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider><ToastProvider><AppInner/></ToastProvider></AuthProvider>
  );
}
