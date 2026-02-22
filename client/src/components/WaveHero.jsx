import { useEffect, useRef, useState } from "react";

const DATA = [
  { v: 0.38, color: "#60a5fa" },
  { v: 0.71, color: "#34d399" },
  { v: 0.52, color: "#f472b6" },
  { v: 0.89, color: "#fbbf24" },
  { v: 0.61, color: "#a78bfa" },
  { v: 0.95, color: "#fb7185" },
  { v: 0.44, color: "#38bdf8" },
];

const W = 240,
  H = 160,
  PX = 16,
  PY = 14;
const IW = W - PX * 2,
  IH = H - PY * 2;
const N = DATA.length;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// ── geometry ──────────────────────────────────────────────────────────────────

function bars(progress = 1) {
  const bw = IW / N;
  return DATA.map((d, i) => {
    const h = IH * d.v * progress;
    return {
      x: PX + i * bw + bw * 0.12,
      y: PY + IH - h,
      w: bw * 0.76,
      h,
      cx: PX + i * bw + bw * 0.5,
      color: d.color,
    };
  });
}

function linePoints() {
  const bw = IW / (N - 1);
  return DATA.map((d, i) => ({
    x: PX + i * bw,
    y: PY + IH * (1 - d.v),
    color: d.color,
  }));
}

function pieSlices(grow = 1) {
  const cx = W / 2,
    cy = H / 2 + 2;
  const r = Math.min(IW, IH) * 0.42 * grow;
  const tot = DATA.reduce((s, d) => s + d.v, 0);
  let a = -Math.PI / 2;
  return DATA.map((d) => {
    const sw = (d.v / tot) * Math.PI * 2;
    const s = a;
    a += sw;
    return { cx, cy, r, s, e: a, color: d.color };
  });
}

function arcPath({ cx, cy, r, s, e }) {
  if (r < 0.5) return "";
  const x1 = cx + r * Math.cos(s),
    y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e),
    y2 = cy + r * Math.sin(e);
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${e - s > Math.PI ? 1 : 0} 1 ${x2},${y2}Z`;
}

function spline(pts) {
  if (!pts.length) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1],
      c = pts[i],
      mx = (p.x + c.x) / 2;
    d += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  return d;
}

// ── 3D CUBE (isometric wireframe) ─────────────────────────────────────────────
// Projects 3D [x,y,z] onto 2D SVG using isometric projection
function iso(x, y, z, cx, cy, s) {
  // isometric: x goes right-down, y goes up, z goes left-down
  const sx = (x - z) * Math.cos(Math.PI / 6) * s;
  const sy = (x + z) * Math.sin(Math.PI / 6) * s - y * s;
  return [cx + sx, cy + sy];
}

// Returns all face paths + colors for a cube centered at (cx,cy),
// rotated by angle, with given scale
function cubeGeometry(cx, cy, angle, scale) {
  const a = angle;
  // unit cube corners in rotated space
  // rotate around Y axis
  const cos = Math.cos(a),
    sin = Math.sin(a);
  const pts3d = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1], // back face
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1], // front face
  ].map(([x, y, z]) => [x * cos - z * sin, y, x * sin + z * cos]);

  const p = pts3d.map(([x, y, z]) => iso(x, y, z, cx, cy, scale));

  const pt = ([ix]) => `${p[ix][0].toFixed(2)},${p[ix][1].toFixed(2)}`;
  const face = (indices) => "M" + indices.map((i) => pt([i])).join(" L") + "Z";

  return [
    // bottom
    {
      d: face([0, 1, 5, 4]),
      fill: "#38bdf8",
      opacity: 0.08,
      stroke: "#38bdf8",
      sOpacity: 0.5,
    },
    // back-left
    {
      d: face([0, 3, 7, 4]),
      fill: "#a78bfa",
      opacity: 0.06,
      stroke: "#a78bfa",
      sOpacity: 0.4,
    },
    // back-right
    {
      d: face([1, 2, 6, 5]),
      fill: "#34d399",
      opacity: 0.06,
      stroke: "#34d399",
      sOpacity: 0.4,
    },
    // top
    {
      d: face([3, 2, 6, 7]),
      fill: "#60a5fa",
      opacity: 0.18,
      stroke: "#60a5fa",
      sOpacity: 0.7,
    },
    // front-left
    {
      d: face([0, 1, 2, 3]),
      fill: "#f472b6",
      opacity: 0.08,
      stroke: "#f472b6",
      sOpacity: 0.45,
    },
    // front-right
    {
      d: face([4, 5, 6, 7]),
      fill: "#fbbf24",
      opacity: 0.12,
      stroke: "#fbbf24",
      sOpacity: 0.6,
    },
  ];
}

// ── phase schedule ────────────────────────────────────────────────────────────
// 0=bar  1=bar→line  2=line  3=line→pie  4=pie  5=pie→cube  6=cube  7=cube→bar
const DUR = [1.4, 0.9, 1.4, 0.9, 1.4, 0.9, 1.8, 0.9];
const TOTAL = DUR.reduce((a, b) => a + b, 0);

// ── atoms ─────────────────────────────────────────────────────────────────────

function Bars({ prog = 1, alpha = 1 }) {
  return (
    <g opacity={alpha}>
      {bars(prog).map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="1.5"
            fill={DATA[i].color}
            opacity="0.18"
          />
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="1.5"
            fill="none"
            stroke={DATA[i].color}
            strokeWidth="1"
            opacity="0.7"
          />
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height="2.5"
            rx="1"
            fill={DATA[i].color}
            opacity="1"
          />
          <rect
            x={b.x}
            y={b.y - 1}
            width={b.w}
            height="4"
            rx="2"
            fill={DATA[i].color}
            opacity="0.35"
            style={{ filter: "blur(2px)" }}
          />
        </g>
      ))}
    </g>
  );
}

function Line({ alpha = 1 }) {
  const pts = linePoints();
  const pd = spline(pts);
  const bot = PY + IH;
  const area = pd + ` L${pts[pts.length - 1].x},${bot} L${pts[0].x},${bot}Z`;
  return (
    <g opacity={alpha}>
      <path d={area} fill="url(#lf)" />
      <path
        d={pd}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={p.color} opacity="0.15" />
          <circle cx={p.x} cy={p.y} r="2.5" fill={p.color} />
          <circle cx={p.x} cy={p.y} r="1" fill="#fff" opacity="0.9" />
        </g>
      ))}
    </g>
  );
}

function Pie({ grow = 1, alpha = 1 }) {
  const slices = pieSlices(grow);
  const { cx, cy, r } = slices[0] || { cx: W / 2, cy: H / 2, r: 0 };
  return (
    <g opacity={alpha}>
      {slices.map((s, i) => (
        <g key={i}>
          <path d={arcPath(s)} fill={s.color} opacity="0.15" />
          <path
            d={arcPath(s)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.2"
            opacity="0.8"
          />
        </g>
      ))}
      {grow > 0.2 && (
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.38}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      )}
      {slices.map((s, i) => {
        const mx = (s.s + s.e) / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + s.r * Math.cos(mx)}
            y2={cy + s.r * Math.sin(mx)}
            stroke={s.color}
            strokeWidth="0.5"
            opacity="0.3"
          />
        );
      })}
    </g>
  );
}

// Cube with continuous slow rotation baked in via `angle` prop
function Cube({ alpha = 1, angle = 0, scale = 1 }) {
  const cx = W / 2,
    cy = H / 2 - 2;
  const faces = cubeGeometry(cx, cy, angle, 28 * scale);
  return (
    <g opacity={alpha}>
      {faces.map((f, i) => (
        <g key={i}>
          <path d={f.d} fill={f.fill} opacity={f.opacity} />
          <path
            d={f.d}
            fill="none"
            stroke={f.stroke}
            strokeWidth="0.9"
            opacity={f.sOpacity}
            strokeLinejoin="round"
          />
        </g>
      ))}
      {/* center glow dot */}
      <circle
        cx={cx}
        cy={cy}
        r="2.5"
        fill="#60a5fa"
        opacity={0.4 * alpha}
        style={{ filter: "blur(2px)" }}
      />
    </g>
  );
}

// ── transitions ───────────────────────────────────────────────────────────────

function BarToLine({ t }) {
  const bs = bars(1),
    lp = linePoints();
  const pts = lp.map((p, i) => ({
    x: lerp(bs[i].cx, p.x, t),
    y: lerp(bs[i].y, p.y, t),
    color: p.color,
  }));
  const bot = PY + IH;
  const pd = spline(pts);
  const area = pd + ` L${pts[pts.length - 1].x},${bot} L${pts[0].x},${bot}Z`;
  return (
    <g>
      {bs.map((b, i) => (
        <g key={i} opacity={lerp(1, 0, t)}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="1.5"
            fill={DATA[i].color}
            opacity="0.18"
          />
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="1.5"
            fill="none"
            stroke={DATA[i].color}
            strokeWidth="1"
            opacity="0.7"
          />
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height="2.5"
            rx="1"
            fill={DATA[i].color}
          />
        </g>
      ))}
      <g opacity={ease(t)}>
        <path d={area} fill="url(#lf)" />
        <path
          d={pd}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={p.color} />
            <circle cx={p.x} cy={p.y} r="1" fill="#fff" opacity="0.9" />
          </g>
        ))}
      </g>
    </g>
  );
}

function LineToPie({ t }) {
  return (
    <g>
      <g opacity={1 - ease(t)}>
        <Line alpha={1} />
      </g>
      <g opacity={ease(t)}>
        <Pie grow={t} alpha={1} />
      </g>
    </g>
  );
}

// Pie slices collapse inward to center → cube assembles outward
function PieToCube({ t, cubeAngle }) {
  const et = ease(t);
  // pie shrinks
  const pieGrow = lerp(1, 0, et);
  // cube assembles — scale up from 0
  const cubeScale = et;
  return (
    <g>
      <g opacity={1 - et}>
        <Pie grow={pieGrow} alpha={1} />
      </g>
      <g opacity={et}>
        <Cube angle={cubeAngle} scale={cubeScale} alpha={1} />
      </g>
    </g>
  );
}

// Cube dissolves → bars rise
function CubeToBar({ t, cubeAngle }) {
  const et = ease(t);
  return (
    <g>
      <g opacity={1 - et}>
        <Cube angle={cubeAngle} scale={1} alpha={1} />
      </g>
      <g opacity={et}>
        <Bars prog={et} alpha={1} />
      </g>
    </g>
  );
}

// ── main content ─────────────────────────────────────────────────────────────

function Content({ phase, pt, cubeAngle }) {
  if (phase === 0) return <Bars prog={1} />;
  if (phase === 1) return <BarToLine t={pt} />;
  if (phase === 2) return <Line />;
  if (phase === 3) return <LineToPie t={pt} />;
  if (phase === 4) return <Pie grow={1} />;
  if (phase === 5) return <PieToCube t={pt} cubeAngle={cubeAngle} />;
  if (phase === 6) return <Cube angle={cubeAngle} scale={1} alpha={1} />;
  if (phase === 7) return <CubeToBar t={pt} cubeAngle={cubeAngle} />;
  return null;
}

// ── exported component ────────────────────────────────────────────────────────

export default function ChartMorph({
  width = 240,
  height = 160,
  style = {},
  className = "",
}) {
  const [t, setT] = useState(0);
  const t0 = useRef(null),
    raf = useRef(null);

  useEffect(() => {
    const tick = (ts) => {
      if (!t0.current) t0.current = ts;
      setT(((ts - t0.current) / 1000) % TOTAL);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  let phase = 0,
    pt = 0,
    acc = 0;
  for (let i = 0; i < DUR.length; i++) {
    if (t < acc + DUR[i]) {
      phase = i;
      pt = (t - acc) / DUR[i];
      break;
    }
    acc += DUR[i];
  }

  const cubeAngle = (t / TOTAL) * Math.PI * 4;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        width: "100%",
        ...style,
      }}
    >
      {/* Heading */}
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            fontWeight: 700,
            lineHeight: 1.2,
            background:
              "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 40%, #38bdf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          AI-Powered Data Visualization
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            color: "#334155",
            fontSize: "0.88rem",
            marginTop: "0.5rem",
            letterSpacing: "0.02em",
          }}
        >
          Describe your data in plain English. Get beautiful charts instantly.
        </p>

        {/* Feature chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            justifyContent: "center",
            marginTop: "1rem",
          }}
        >
          {[
            { icon: "📊", label: "Bar & Line" },
            { icon: "🥧", label: "Pie & Donut" },
            { icon: "🌡️", label: "Heatmaps" },
            { icon: "✦", label: "3D Charts" },
            { icon: "📁", label: "Upload CSV" },
          ].map(({ icon, label }) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.28rem 0.75rem",
                borderRadius: "999px",
                background: "rgba(56,189,248,0.06)",
                border: "1px solid rgba(56,189,248,0.14)",
                color: "#2d6a8a",
                fontSize: "0.75rem",
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.01em",
              }}
            >
              <span style={{ fontSize: "0.8rem" }}>{icon}</span>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Chart — centered with margin: auto */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          display: "block",
          overflow: "visible",
          width,
          height,
          margin: "0 auto",
        }}
      >
        <defs>
          <linearGradient id="lf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <Content phase={phase} pt={pt} cubeAngle={cubeAngle} />
      </svg>
    </div>
  );
}
