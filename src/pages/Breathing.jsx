import { useState, useEffect, useRef } from "react";
import { BREATHING_EXERCISES } from "../data/gameData";
import { useToast } from "../components/Toast";

export default function Breathing() {
  const toast = useToast();
  const [selected, setSelected] = useState(BREATHING_EXERCISES[0]);
  const [running,  setRunning]  = useState(false);
  const [phase,    setPhase]    = useState("idle");
  const [counter,  setCounter]  = useState(0);
  const [cycle,    setCycle]    = useState(0);
  const [totalCycles, setTotalCycles] = useState(4);
  const stateRef = useRef({ running:false, phaseIdx:0, currentCycle:0, counter:0 });

  const PHASES = ["inhale","hold1","exhale","hold2"];

  function phaseDur(p) { return selected[p] || 0; }
  const PHASE_LABELS = { inhale:"Inhale", hold1:"Hold", exhale:"Exhale", hold2:"Hold", idle:"Ready", done:"Complete" };
  const PHASE_COLORS = { inhale:"#4DC9FF", hold1:"#FFD700", exhale:"#00FF88", hold2:"#FF9800", idle:"#333", done:"#00FF88" };

  function stop() {
    stateRef.current.running = false;
    setRunning(false);
    setPhase("idle");
    setCounter(0);
    setCycle(0);
    stateRef.current = { running:false, phaseIdx:0, currentCycle:0, counter:0 };
  }

  function start() {
    // Find first phase with nonzero duration
    let idx = 0;
    while (idx < PHASES.length && phaseDur(PHASES[idx]) === 0) idx++;
    const dur = phaseDur(PHASES[idx]);
    stateRef.current = { running:true, phaseIdx:idx, currentCycle:0, counter:dur };
    setRunning(true);
    setPhase(PHASES[idx]);
    setCounter(dur);
    setCycle(0);
  }

  // Fixed tick loop using ref-based state to avoid stale closures
  useEffect(() => {
    if (!running) return;
    const s = stateRef.current;

    const interval = setInterval(() => {
      s.counter--;
      if (s.counter <= 0) {
        // Advance phase
        let nextIdx = s.phaseIdx + 1;
        while (nextIdx < PHASES.length && phaseDur(PHASES[nextIdx]) === 0) nextIdx++;

        if (nextIdx >= PHASES.length) {
          // End of cycle
          s.currentCycle++;
          setCycle(s.currentCycle);
          if (s.currentCycle >= totalCycles) {
            clearInterval(interval);
            s.running = false;
            setRunning(false);
            setPhase("done");
            setCounter(0);
            toast("🎉 Breathing session complete!", "success");
            return;
          }
          // Reset to first valid phase
          nextIdx = 0;
          while (nextIdx < PHASES.length && phaseDur(PHASES[nextIdx]) === 0) nextIdx++;
        }

        s.phaseIdx = nextIdx;
        s.counter  = phaseDur(PHASES[nextIdx]);
        setPhase(PHASES[nextIdx]);
        setCounter(s.counter);
      } else {
        setCounter(s.counter);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [running, selected, totalCycles]);

  // Visual ring scale
  const scale = phase==="inhale" ? 1.35 : phase==="exhale" ? 0.72 : 1.0;
  const pColor = PHASE_COLORS[phase] || "#888";

  // Session duration estimate
  const secPerCycle = PHASES.reduce((a,p) => a + phaseDur(p), 0);
  const totalSec    = secPerCycle * totalCycles;
  const minStr      = `${Math.floor(totalSec/60)}:${String(totalSec%60).padStart(2,"0")}`;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">🌬️ Breathing</h1><p className="page-sub">Calm your nervous system and reset your focus</p></div>
      </div>

      <div className="breathing-layout">
        {/* Left: exercise selector */}
        <div className="breathing-left">
          <h3 style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Technique</h3>
          <div className="exercise-list">
            {BREATHING_EXERCISES.map(ex => (
              <button key={ex.id} className={`exercise-option ${selected.id===ex.id?"active":""}`}
                onClick={() => { if (!running) { setSelected(ex); stop(); } }}
                disabled={running}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{ex.name}</div>
                <div style={{ fontSize:12, color:"#888", lineHeight:1.4 }}>{ex.desc}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:6, fontFamily:"monospace" }}>
                  {ex.inhale}s inhale
                  {ex.hold1>0 ? ` · ${ex.hold1}s hold` : ""}
                  {` · ${ex.exhale}s exhale`}
                  {ex.hold2>0 ? ` · ${ex.hold2}s hold` : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="cycle-selector">
            <label style={{ fontSize:12, color:"#666", textTransform:"uppercase", letterSpacing:.5 }}>
              Cycles &nbsp;<span style={{ color:"#555", fontFamily:"monospace" }}>({minStr})</span>
            </label>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              {[2,4,6,8].map(n => (
                <button key={n} className={`cycle-btn ${totalCycles===n?"active":""}`}
                  onClick={() => !running && setTotalCycles(n)}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: animated ring */}
        <div className="breathing-center">
          <div className="breath-circle-wrap">
            {/* Outer glow ring */}
            <div className="breath-glow" style={{ boxShadow:`0 0 ${phase==="inhale"?60:20}px ${pColor}22`, transition:"box-shadow 1s ease" }}/>
            <div className="breath-ring" style={{
              transform: `scale(${scale})`,
              borderColor: pColor,
              transition: `transform ${phase==="inhale" ? selected.inhale : phase==="exhale" ? selected.exhale : 0.5}s ease, border-color .5s ease`,
              boxShadow: `inset 0 0 40px ${pColor}11`,
            }}>
              <div className="breath-inner">
                <div className="breath-phase" style={{ color: pColor }}>{PHASE_LABELS[phase]}</div>
                {counter > 0 && <div className="breath-counter">{counter}</div>}
                {phase==="done" && <div style={{ fontSize:32 }}>✅</div>}
              </div>
            </div>
          </div>

          {/* Cycle progress dots */}
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            {Array.from({ length: totalCycles }).map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius:"50%",
                background: i < cycle ? "#00FF88" : i === cycle && running ? pColor : "#1a1a1a",
                border: `1px solid ${i === cycle && running ? pColor : "#333"}`,
                transition:"background .3s"
              }}/>
            ))}
          </div>

          <div style={{ display:"flex", gap:12 }}>
            {!running
              ? <button className="btn-primary" onClick={start} style={{ width:"auto", padding:"12px 48px" }}>
                  {phase==="done" ? "Again" : "Start"}
                </button>
              : <button className="btn-secondary" onClick={stop}>Stop</button>
            }
          </div>

          {phase==="done" && (
            <div className="success-banner" style={{ marginTop:24, maxWidth:320 }}>
              🎉 {totalCycles} cycles complete. Take a moment to notice how you feel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
