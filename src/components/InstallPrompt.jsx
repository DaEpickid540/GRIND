import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "grind_install_dismissed_until";
const DISMISS_DAYS = 14;

function isDismissed() {
  const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() < until;
}
function dismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400000));
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

// Custom "Install GRIND" affordance.
// - Android Chrome / Desktop Chrome & Edge (Windows): listens for the native
//   `beforeinstallprompt` event, suppresses the browser's own mini-infobar,
//   and shows our own trigger that calls `.prompt()` on click.
// - iOS Safari: has no `beforeinstallprompt` API at all, so there's nothing to
//   trigger programmatically — instead we show a purely instructional banner
//   pointing at Share > Add to Home Screen.
// - Never shown once the app is already running installed/standalone.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
      return;
    }

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onInstalled = () => { setVisible(false); dismiss(); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  return (
    <div className="install-banner" role="complementary" aria-label="Install GRIND">
      <div className="install-banner-icon">
        {showIOSHint ? <Smartphone size={18}/> : <Download size={18}/>}
      </div>
      <div className="install-banner-text">
        {showIOSHint ? (
          <>
            <strong>Install GRIND</strong>
            <span>Tap Share, then "Add to Home Screen"</span>
          </>
        ) : (
          <>
            <strong>Install GRIND</strong>
            <span>Add it to your device for the full app experience</span>
          </>
        )}
      </div>
      {!showIOSHint && (
        <button className="install-banner-btn" onClick={handleInstall}>Install</button>
      )}
      <button className="install-banner-close" onClick={handleDismiss} aria-label="Dismiss">
        <X size={16}/>
      </button>
    </div>
  );
}
