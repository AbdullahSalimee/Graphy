import { useState, useEffect } from "react";

export default function WaveHero() {
  const [pts, setPts] = useState({
    a: [0.45, 0.55, 0.4, 0.6, 0.35, 0.5],
    b: [0.3, 0.5, 0.65, 0.4, 0.55, 0.45],
    c: [0.55, 0.35, 0.5, 0.45, 0.6, 0.4],
  });

  useEffect(() => {
    let raf;
    const animate = () => {
      const t = Date.now();
      setPts({
        a: [0,1,2,3,4,5].map((i) => clamp(0.5 + Math.sin(t / 1800 + i * 0.8) * 0.22)),
        b: [0,1,2,3,4,5].map((i) => clamp(0.45 + Math.sin(t / 2400 + i * 0.6 + 1) * 0.28)),
        c: [0,1,2,3,4,5].map((i) => clamp(0.55 + Math.sin(t / 1200 + i * 1.1 + 2) * 0.18)),
      });
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hero">
      <div className="hero-wave">
        <svg viewBox="0 0 600 280" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gA" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="gB" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="gC" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d={toPath(pts.c, 600, 280)} fill="url(#gC)" stroke="#c084fc" strokeWidth="1" strokeOpacity="0.5" />
          <path d={toPath(pts.b, 600, 280)} fill="url(#gB)" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.65" />
          <path d={toPath(pts.a, 600, 280)} fill="url(#gA)" stroke="#7dd3fc" strokeWidth="1.5" strokeOpacity="0.85" />
        </svg>
      </div>
      <div className="hero-text">
        <h1 className="hero-title">AI-Powered Data Visualization</h1>
        <p className="hero-subtitle">
          Describe your data in plain English.<br />Get beautiful interactive charts instantly.
        </p>
        <div className="hero-chips">
          <span className="chip">📊 Bar & Line charts</span>
          <span className="chip">🥧 Pie & Donut</span>
          <span className="chip">🌡 Heatmaps</span>
          <span className="chip">📁 Upload CSV / JSON</span>
        </div>
      </div>
    </div>
  );
}

const clamp = (v) => Math.max(0.05, Math.min(0.95, v));

function toPath(pts, W, H) {
  const segs = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W;
    return `${i === 0 ? "M" : "L"} ${x},${H * (1 - p)}`;
  }).join(" ");
  return `${segs} L ${W},${H} L 0,${H} Z`;
}
