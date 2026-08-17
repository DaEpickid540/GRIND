import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Eye, Zap } from "lucide-react";
import { callAI, hasValidKey } from "../lib/aiProvider";
import { buildSystemPromptSync } from "../lib/coachVoice";
import { buildUserContext } from "../lib/userContext";
import { buildPageContext } from "../lib/pageContext";
import { buildSearchContext } from "../lib/searchProvider";
import { ACTIONS_PROMPT, parseActions, createActionRunner } from "../lib/domActions";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "./Toast";

// Keeps the prompt from growing without bound in a long session. Older turns
// fall off; the user-data and page-context blocks are rebuilt fresh each send
// anyway, so the model never loses track of the important state.
const MAX_HISTORY_TURNS = 12;

const SUGGESTIONS = [
  "What should I focus on today?",
  "Why is my streak at risk?",
  "Explain what's on this screen",
  "Take me to my gym records",
];

export default function AISidebar({ open, onClose, page, handlers }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [busy, setBusy]         = useState(false);
  const scrollRef = useRef();
  const inputRef  = useRef();

  const runAction = useRef(createActionRunner(handlers));
  useEffect(() => { runAction.current = createActionRunner(handlers); }, [handlers]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    if (!hasValidKey()) { toast("No API key set — go to Settings ⚙️", "error"); return; }

    setInput("");
    const nextMessages = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    setBusy(true);

    try {
      // Rebuilt on every send, not cached into history: the user may have
      // navigated, checked off habits or scanned something mid-conversation,
      // and stale page context is worse than none.
      const [userCtx, searchCtx] = await Promise.all([
        buildUserContext(user?.uid, profile),
        buildSearchContext(q),           // best-effort; returns "" when search is off
      ]);
      const pageCtx = buildPageContext({ page });

      const system = [
        buildSystemPromptSync("chat", null, null),
        userCtx,
        pageCtx,
        searchCtx,
        ACTIONS_PROMPT,
      ].filter(Boolean).join("\n\n");

      const reply = await callAI({
        system,
        userMessage: q,
        history: nextMessages.slice(-MAX_HISTORY_TURNS, -1),
        maxTokens: 900,
      });

      const { text: visible, actions } = parseActions(reply);

      // Auto-tier actions are navigation/visual only, so they run immediately.
      // Anything that writes a setting or types into a field is surfaced as a
      // button instead — the model proposes, the user commits.
      const auto    = actions.filter(a => a.tier === "auto");
      const pending = actions.filter(a => a.tier === "confirm");

      setMessages(m => [...m, {
        role: "assistant",
        content: visible || "(no reply)",
        pending,
        ran: auto.map(a => a.summary),
      }]);

      for (const a of auto) {
        try { runAction.current(a); } catch (e) { console.error("[AI sidebar] action failed", a, e); }
      }
    } catch (e) {
      const msg =
        e.message === "NO_KEY"     ? "No API key set — go to Settings ⚙️" :
        e.message === "NO_VISION"  ? "That model can't read images." :
        `Couldn't reach the AI (${e.message})`;
      setMessages(m => [...m, { role: "assistant", content: msg, error: true }]);
    } finally { setBusy(false); }
  }

  function confirmAction(msgIdx, action) {
    let result;
    try { result = runAction.current(action); }
    catch (e) { result = `Failed: ${e.message}`; }
    setMessages(m => m.map((msg, i) => i === msgIdx
      ? { ...msg, pending: msg.pending.filter(p => p !== action), ran: [...(msg.ran || []), result] }
      : msg));
  }

  if (!open) return null;

  return (
    <aside className="ai-sidebar" role="complementary" aria-label="AI coach">
      <div className="ai-sb-header">
        <span className="ai-sb-title"><Sparkles size={16}/> Coach</span>
        <span className="ai-sb-sees" title="The coach can read what's on your screen (never your API keys)">
          <Eye size={12}/> sees this page
        </span>
        <button className="ai-sb-close" onClick={onClose} aria-label="Close coach"><X size={16}/></button>
      </div>

      <div className="ai-sb-body" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-sb-empty">
            <p>Ask me anything — I can see your stats, your scans, and whatever's on screen right now.</p>
            <div className="ai-sb-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="ai-sb-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}${m.error ? " ai-msg-error" : ""}`}>
            <div className="ai-msg-text">{m.content}</div>

            {m.ran?.length > 0 && (
              <div className="ai-msg-ran">
                {m.ran.map((r, j) => <div key={j} className="ai-ran-line"><Zap size={11}/> {r}</div>)}
              </div>
            )}

            {m.pending?.length > 0 && (
              <div className="ai-msg-actions">
                {m.pending.map((a, j) => (
                  <button key={j} className="ai-action-btn" onClick={() => confirmAction(i, a)}>
                    {a.summary}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {busy && <div className="ai-msg ai-msg-assistant ai-msg-busy"><Loader2 size={14} className="ai-spin"/> thinking…</div>}
      </div>

      <form className="ai-sb-input" onSubmit={e => { e.preventDefault(); send(); }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask your coach…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          <Send size={15}/>
        </button>
      </form>
    </aside>
  );
}

// Floating launcher — lives outside the panel so it stays reachable when closed.
export function AISidebarToggle({ onClick, open }) {
  if (open) return null;
  return (
    <button className="ai-sb-fab" onClick={onClick} aria-label="Open AI coach" title="Ask your coach">
      <MessageCircle size={20}/>
    </button>
  );
}
