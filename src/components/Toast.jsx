// Global toast notification system
import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type="info", duration=3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);

  // Expose globally for non-React systems (like the reminder timer)
  useEffect(() => { window.__grindToast = toast; return () => { delete window.__grindToast; }; }, [toast]);

  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"💬", xp:"⚡", streak:"🔥", levelup:"🎖️" };
  const colors = { success:"#00FF88", error:"#FF4D4D", warning:"#FFD700", info:"#4DC9FF", xp:"#FFD700", streak:"#FF4D4D", levelup:"#B84DFF" };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderColor: colors[t.type]||colors.info }}>
            <span>{icons[t.type]||icons.info}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
