import { useEffect, useRef } from "react";

export default function Confetti({ active, onDone }) {
  const canvasRef = useRef();

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#FFD700","#FF4D4D","#4DC9FF","#00FF88","#FF88FF","#FF9800"];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 8,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    }));

    let frame;
    let done = false;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.rotV;
        p.vy += 0.12;
        p.life -= 0.008;
        if (p.life > 0 && p.y < canvas.height + 20) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
          ctx.restore();
        }
      });
      if (alive) { frame = requestAnimationFrame(tick); }
      else if (!done) { done = true; onDone?.(); }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999 }}/>;
}
