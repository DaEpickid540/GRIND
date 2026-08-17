// Global toast notification system
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, MessageCircle, Zap, Flame, Medal } from "lucide-react";

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

  const icons = { success:CheckCircle2, error:XCircle, warning:AlertTriangle, info:MessageCircle, xp:Zap, streak:Flame, levelup:Medal };
  const colors = { success:"#00FF88", error:"#FF4D4D", warning:"#D4A017", info:"#4DC9FF", xp:"#D4A017", streak:"#FF4D4D", levelup:"#B84DFF" };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
        {toasts.map(t => {
          const Icon = icons[t.type] || icons.info;
          return (
            <div key={t.id} className="toast" style={{ borderColor: colors[t.type]||colors.info }}
              role={t.type === "error" || t.type === "warning" ? "alert" : undefined}>
              <Icon size={16} color={colors[t.type]||colors.info} aria-hidden="true" style={{ flexShrink:0 }}/>
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
