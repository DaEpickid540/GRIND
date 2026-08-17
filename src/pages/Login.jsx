import { Zap } from "lucide-react";
import { loginWithGoogle } from "../lib/firebase";

export default function Login() {
  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <Zap className="login-bolt" size={48} strokeWidth={2.5} color="var(--accent)"/>
          <h1 className="login-title">GRIND</h1>
        </div>
        <p className="login-tagline">Turn your life into a game.<br/>Win it every day.</p>
        <div className="login-features">
          {["🔥 Streaks & XP","🏋️ Gym Records","📸 AI Scans","🥗 Nutrition","🌬️ Breathing","🏆 Leaderboard","📋 AI Weekly Plans","⚔️ Friend Challenges"].map(f=>(
            <div key={f} className="login-feature-pill">{f}</div>
          ))}
        </div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <h2>Get Started</h2>
          <p>Sign in to begin your transformation</p>
          <button className="login-btn" onClick={() => loginWithGoogle().catch(console.error)}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.8 6C12.5 13.1 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
              <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 019.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A23.9 23.9 0 000 24c0 3.9.9 7.5 2.5 10.8l8-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.8 2.3-6.2 0-11.5-3.6-13.5-8.8l-8 6.1C6.7 42.6 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
          <p className="login-disclaimer">Free forever. No credit card needed.</p>
        </div>
      </div>
    </div>
  );
}
