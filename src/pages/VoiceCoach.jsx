import { useState, useRef, useEffect } from "react";
import { Mic, Square, Sparkles, AlertTriangle } from "lucide-react";
import { callAI } from "../lib/aiProvider";
import { useToast } from "../components/Toast";
import { useAuth } from "../hooks/useAuth";
import { saveScanResult, getScanHistory } from "../lib/firebase";
import { buildSystemPrompt } from "../lib/coachVoice";

function parseAIJson(text) {
  const stripped = text.replace(/```json|```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

// Common hedge/filler words — case-insensitive whole-word matches
const FILLER_RE = /\b(um+|uh+|erm+|like|you know|i mean|sort of|kind of|basically|actually)\b/gi;

function computeStats(transcript, durationSec) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const fillerCount = (transcript.match(FILLER_RE) || []).length;
  const wpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 0;
  return { wordCount, fillerCount, durationSec: Math.round(durationSec), wpm };
}

const SpeechRecognitionCtor = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

function renderResult(r) {
  const s = r.stats || {};
  const scoreColor = r.score >= 80 ? "#00FF88" : r.score >= 60 ? "var(--accent)" : "#FF4D4D";
  return (
    <div className="scan-result">
      <div className="scan-score" style={{ color:scoreColor }}>{r.score}<span style={{ fontSize:18 }}>/100</span></div>
      <p style={{ color:"#ccc", margin:"8px 0" }}>{r.summary}</p>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", margin:"12px 0" }}>
        <div className="stat-chip"><span style={{ color:"#4DC9FF" }}>{s.wpm}</span><span>&nbsp;wpm</span></div>
        <div className="stat-chip"><span style={{ color:"#FF9800" }}>{s.fillerCount}</span><span>&nbsp;fillers</span></div>
        <div className="stat-chip"><span style={{ color:"#00FF88" }}>{s.wordCount}</span><span>&nbsp;words</span></div>
        <div className="stat-chip"><span style={{ color:"var(--accent)" }}>{s.durationSec}s</span><span>&nbsp;duration</span></div>
      </div>

      {r.confidence  && <p style={{ margin:"6px 0", fontSize:13 }}><strong>Confidence:</strong> {r.confidence}</p>}
      {r.clarity     && <p style={{ margin:"6px 0", fontSize:13 }}><strong>Clarity:</strong> {r.clarity}</p>}
      {r.fillerNote  && <p style={{ margin:"6px 0", fontSize:13 }}><strong>Filler words:</strong> {r.fillerNote}</p>}

      <div className="scan-lists">
        <div><h4 style={{ color:"#00FF88" }}>Strengths</h4>{r.strengths?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
        <div><h4 style={{ color:"#FF4D4D" }}>Improve</h4>{r.improvements?.map((s,i)=><div key={i} className="scan-item">{s}</div>)}</div>
      </div>
      {r.tip && <div className="scan-tip">{r.tip}</div>}
    </div>
  );
}

export default function VoiceCoach() {
  const toast = useToast();
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim,    setInterim]    = useState("");
  const [result,     setResult]     = useState(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [history,    setHistory]    = useState([]);

  const recognitionRef     = useRef(null);
  const recordingRef       = useRef(false);
  const startTimeRef       = useRef(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    if (!user) return;
    getScanHistory(user.uid, "voice").then(setHistory);
  }, [user]);

  // Stop any live recognition if the user navigates away mid-recording
  useEffect(() => () => {
    recordingRef.current = false;
    if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); }
  }, []);

  function startRecording() {
    if (!SpeechRecognitionCtor) {
      toast("Voice Coach needs Chrome or Edge — speech recognition isn't supported here", "error");
      return;
    }
    setResult(null);
    setTranscript("");
    setInterim("");
    finalTranscriptRef.current = "";
    startTimeRef.current = Date.now();
    recordingRef.current = true;

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let final = finalTranscriptRef.current;
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk + " ";
        else live += chunk;
      }
      finalTranscriptRef.current = final;
      setTranscript(final);
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      const msg = e.error === "not-allowed" ? "Mic access denied — allow microphone permission to use Voice Coach" : "Mic error — try again";
      toast(msg, "error");
      recordingRef.current = false;
      setRecording(false);
    };
    // Some browsers auto-stop recognition after a pause — restart transparently
    // as long as the user hasn't hit Stop themselves.
    rec.onend = () => {
      if (recognitionRef.current === rec && recordingRef.current) {
        try { rec.start(); } catch { /* already starting */ }
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRecording() {
    recordingRef.current = false;
    setRecording(false);
    setInterim("");
    const rec = recognitionRef.current;
    if (rec) { rec.onend = null; rec.stop(); recognitionRef.current = null; }
  }

  async function analyze() {
    const text = finalTranscriptRef.current.trim();
    if (!text) { toast("Record something first", "warning"); return; }
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const durationSec = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      const stats = computeStats(text, durationSec);
      const system = await buildSystemPrompt("voiceCoach", user?.uid, null);
      const userMessage = `Transcript:\n"""${text}"""\n\nStats computed directly from the recording (ground truth, don't re-estimate): duration ${stats.durationSec}s, ${stats.wordCount} words, ~${stats.wpm} words/min, ${stats.fillerCount} filler words detected.`;
      const aiText = await callAI({ system, userMessage, maxTokens: 700 });
      const parsed = parseAIJson(aiText);
      const full = { ...parsed, stats };
      setResult(full);
      if (user) {
        await saveScanResult(user.uid, "voice", full);
        const updated = await getScanHistory(user.uid, "voice");
        setHistory(updated);
      }
      toast("Voice Coach feedback ready!", "success");
    } catch (e) {
      if (e.message === "NO_KEY") toast("No API key set — go to Settings ⚙️", "error");
      else toast("Analysis failed — try again", "error");
      console.error(e);
    } finally { setAnalyzing(false); }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display:"inline-flex", alignItems:"center", gap:10 }}>
            <Mic size={32}/> Voice Coach
          </h1>
          <p className="page-sub">Practice speaking out loud, get honest feedback on clarity and delivery</p>
        </div>
      </div>

      {!SpeechRecognitionCtor && (
        <div className="vision-only-banner">
          <AlertTriangle size={20} style={{ flexShrink:0 }}/>
          <div>
            <strong>Speech recognition not supported in this browser</strong>
            <span style={{ display:"block", fontSize:12, color:"#FF9800", marginTop:2 }}>
              Voice Coach needs live speech-to-text — try Chrome or Edge on desktop or Android.
            </span>
          </div>
        </div>
      )}

      <div className="scan-layout">
        <div className="scan-upload">
          <div className="voice-record-zone" style={{ height:300 }}>
            {recording ? (
              <>
                <div className="voice-rec-indicator"><span className="voice-rec-dot"/> Recording…</div>
                <p className="voice-live-transcript">
                  {transcript || <span style={{ opacity:.5 }}>Start talking…</span>}
                  {interim && <span style={{ opacity:.5 }}> {interim}</span>}
                </p>
              </>
            ) : transcript ? (
              <p className="voice-live-transcript">{transcript}</p>
            ) : (
              <>
                <Mic size={56} style={{ opacity:.4 }}/>
                <p>Tap record and speak naturally for 30–60s</p>
              </>
            )}
          </div>

          {!recording ? (
            <button className="btn-primary" onClick={startRecording} disabled={!SpeechRecognitionCtor || analyzing} style={{ marginTop:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Mic size={18}/> {transcript ? "Record Again" : "Start Recording"}
            </button>
          ) : (
            <button className="btn-primary" onClick={stopRecording} style={{ marginTop:12, background:"var(--red)", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Square size={18}/> Stop Recording
            </button>
          )}

          {!recording && transcript && (
            <button className="btn-primary" onClick={analyze} disabled={analyzing} style={{ marginTop:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Sparkles size={18}/> {analyzing ? "Analyzing…" : "Get Feedback"}
            </button>
          )}
        </div>

        <div className="scan-results">
          {!result && !analyzing && (
            <div className="empty-state-card">
              <p style={{ color:"#555" }}>Record yourself talking through anything — a pitch, an intro, practicing for a hard conversation — and get honest, specific feedback.</p>
            </div>
          )}
          {analyzing && <div className="loading-card"><div className="spinner"/><p>Analyzing…</p></div>}
          {result && renderResult(result)}

          {history.length > 0 && (
            <div className="scan-history">
              <h4 style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:.5, margin:"20px 0 10px" }}>
                Past Sessions ({history.length})
              </h4>
              <div className="scan-history-list">
                {history.map(h => {
                  const r = h.result || {};
                  const when = h.timestamp?.toDate ? h.timestamp.toDate().toLocaleDateString() : "recent";
                  return (
                    <button key={h.id} className="scan-history-item" onClick={() => setResult(r)}>
                      <span className="shi-score">{r.score ?? "✓"}</span>
                      <span className="shi-date">{when}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
