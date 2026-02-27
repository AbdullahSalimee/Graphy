import { useState, useRef, useEffect } from "react";

// ── Chart taxonomy ────────────────────────────────────────────────────────────
// label = what user sees | prompt = exact words injected into AI prompt
const CHART_GROUPS = [
  {
    id: "line-scatter",
    label: "Line & Scatter",
    icon: "〜",
    color: "#38bdf8",
    description: "Trends, correlations, time series",
    subtypes: [
      { label: "AI Choice", prompt: null }, // null = let AI decide
      { label: "Line & Scatter Plot", prompt: "Line and Scatter Plot" },
      {
        label: "Data Labels Hover",
        prompt: "Line and Scatter Plot Data Labels Hover",
      },
      {
        label: "Line with Data Labels",
        prompt: "Line chart Data Labels on The Plot",
      },
      {
        label: "Scatter + Color Dimension",
        prompt: "Scatter Plot with a Color Dimension",
      },
      { label: "Grouped Scatter", prompt: "Grouped Scatter Plot" },
      {
        label: "Grouped Scatter Custom Gap",
        prompt: "Grouped Scatter Plot with Custom Scatter Gap",
      },
      { label: "Basic Line Plot", prompt: "Basic Line Plot" },
      { label: "Named Lines", prompt: "Adding Names to Line and Scatter Plot" },
      { label: "Stylized Line & Scatter", prompt: "Line and Scatter Stylized" },
      { label: "Styled Line Plot", prompt: "Styling Line Plot" },
      { label: "Colored Scatter", prompt: "Colored and Styled Scatter Plot" },
      {
        label: "Line Shape Interpolation",
        prompt: "Line Shape Options for Interpolation",
      },
      { label: "Line Dash", prompt: "Line Dash" },
      { label: "Connect Gaps", prompt: "line chart Connect Gaps Between Data" },
      { label: "Annotated Lines", prompt: "Labelling Lines with Annotations" },
    ],
  },
  {
    id: "bar",
    label: "Bar Charts",
    icon: "▐",
    color: "#34d399",
    description: "Comparisons, rankings, categories",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Basic Bar Chart", prompt: "Basic Bar Chart" },
      { label: "Grouped Bar", prompt: "Grouped Bar Chart" },
      { label: "Stacked Bar", prompt: "Stacked Bar Chart" },
      { label: "Bar with Hover Text", prompt: "Bar Chart with Hover Text" },
      {
        label: "Bar with Direct Labels",
        prompt: "Bar Chart with Direct Labels",
      },
      {
        label: "Grouped Bar Direct Labels",
        prompt: "Grouped Bar Chart with Direct Labels",
      },
      { label: "Rotated Labels", prompt: "Bar Chart with Rotated Labels" },
      {
        label: "Custom Bar Colors",
        prompt: "Customizing Individual Bar Colors",
      },
      { label: "Custom Bar Base", prompt: "Customizing Individual Bar Base" },
      { label: "Colored & Styled Bar", prompt: "Colored and Styled Bar Chart" },
      { label: "Relative Barmode", prompt: "Bar Chart with Relative Barmode" },
    ],
  },
  {
    id: "pie-bubble",
    label: "Pie & Bubble",
    icon: "◉",
    color: "#f472b6",
    description: "Proportions, distributions, sizes",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Basic Pie Chart", prompt: "Basic Pie Chart" },
      { label: "Donut Chart", prompt: "Donut Chart" },
      { label: "Bubble Chart", prompt: "bubble chart" },
      { label: "Bubble Marker Size", prompt: "Marker Size on Bubble Charts" },
      {
        label: "Bubble Size + Color",
        prompt: "Marker Size and Color on Bubble Charts",
      },
      { label: "Bubble Hover Text", prompt: "Hover Text on Bubble Charts" },
      { label: "Bubble Size Scaling", prompt: "Bubble Size Scaling on Charts" },
      {
        label: "Marker Array (Beautiful)",
        prompt: "Marker Size, Color, and Symbol as an Array",
      },
    ],
  },
  {
    id: "statistical",
    label: "Statistical",
    icon: "σ",
    color: "#fbbf24",
    description: "Distributions, errors, outliers",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Symmetric Error Bars", prompt: "Basic Symmetric Error Bars" },
      { label: "Bar with Error Bars", prompt: "Bar Chart with Error Bars" },
      { label: "Horizontal Error Bars", prompt: "Horizontal Error Bars" },
      { label: "Asymmetric Error Bars", prompt: "Asymmetric Error Bars" },
      { label: "Styled Error Bars", prompt: "Colored and Styled Error Bars" },
      { label: "Basic Box Plot", prompt: "Basic Box Plot" },
      {
        label: "Box + Underlying Data",
        prompt: "Box Plot That Displays the Underlying Data",
      },
      { label: "Horizontal Box Plot", prompt: "Horizontal Box Plot" },
      { label: "Grouped Box Plot", prompt: "Grouped Box Plot" },
      { label: "Box Styled Outliers", prompt: "Box Plot Styling Outliers" },
      { label: "Fully Styled Box Plot", prompt: "Fully Styled Box Plot" },
      { label: "Rainbow Box Plot", prompt: "Rainbow Box Plot" },
    ],
  },
  {
    id: "histogram",
    label: "Histograms",
    icon: "⬛",
    color: "#a78bfa",
    description: "Frequency, distribution, density",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Basic Histogram", prompt: "Basic Histogram" },
      { label: "Overlaid Histogram", prompt: "Overlaid Histogram" },
      { label: "Stacked Histograms", prompt: "Stacked Histograms" },
      { label: "Styled Histogram", prompt: "Colored and Styled Histograms" },
      { label: "Cumulative Histogram", prompt: "Cumulative Histogram" },
      { label: "Normalized Histogram", prompt: "Normalized Histogram" },
      {
        label: "2D Histogram Contour",
        prompt: "2D Histogram Contour Plot with Histogram Subplots",
      },
      {
        label: "2D Histogram + Slider",
        prompt: "2D Histogram Contour Plot with Slider Control",
      },
    ],
  },
  {
    id: "filled-error",
    label: "Filled & Error",
    icon: "≋",
    color: "#fb7185",
    description: "Confidence bands, filled areas",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Filled Lines", prompt: "Filled Lines" },
      {
        label: "Continuous Error Filled",
        prompt: "Continuous Error Bars Filled Lines",
      },
      {
        label: "Asymmetric + Offset",
        prompt: "Asymmetric Error Bars with a Constant Offset",
      },
      { label: "Continuous Error Bars", prompt: "Continuous Error Bars" },
    ],
  },
  {
    id: "contour-heat",
    label: "Contour & Heat",
    icon: "◈",
    color: "#22d3ee",
    description: "Density, intensity, 2D patterns",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Simple Contour", prompt: "Simple Contour Plot" },
      { label: "Basic Contour", prompt: "Basic Contour Plot" },
      { label: "Contour Lines", prompt: "Contour Lines" },
      { label: "Contour Labels", prompt: "Contour Line Labels" },
      { label: "Basic Heatmap", prompt: "Basic Heatmap" },
      {
        label: "Categorical Heatmap",
        prompt: "Heatmap with Categorical Axis Labels",
      },
      { label: "Annotated Heatmap", prompt: "Annotated Heatmap" },
    ],
  },
  {
    id: "scientific",
    label: "Scientific",
    icon: "⬡",
    color: "#4ade80",
    description: "Ternary, parallel coords, log scales",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Ternary + Markers", prompt: "Basic Ternary Plot with Markers" },
      { label: "Soil Types Ternary", prompt: "Soil Types Ternary Plot" },
      {
        label: "Basic Parallel Coords",
        prompt: "Basic Parallel Coordinates Plot",
      },
      { label: "Parallel Coordinates", prompt: "Parallel Coordinates Plot" },
      {
        label: "Advanced Parallel Coords",
        prompt: "Advanced Parallel Coordinates Plot",
      },
      { label: "Log Plots", prompt: "Log Plots" },
      { label: "Logarithmic Axes", prompt: "Logarithmic Axes" },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    icon: "₿",
    color: "#f59e0b",
    description: "Candlestick, waterfall, funnel, time series",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "Basic Waterfall", prompt: "Basic Waterfall Chart" },
      {
        label: "Multi-Category Waterfall",
        prompt: "Multi Category Waterfall Chart",
      },
      { label: "Styled Waterfall", prompt: "Style Waterfall Chart" },
      { label: "Simple Candlestick", prompt: "Simple Candlestick Chart" },
      {
        label: "Candlestick No Slider",
        prompt: "Candlestick Chart without Rangeslider",
      },
      {
        label: "Candlestick + Annotations",
        prompt: "Customise Candlestick Chart with Shapes and Annotations",
      },
      {
        label: "Candlestick + Rangeselector",
        prompt: "Candlestick Charts Add Rangeselector",
      },
      { label: "Basic Funnel", prompt: "Basic Funnel Plot" },
      {
        label: "Funnel + Marker Style",
        prompt: "Funnel Plot Setting Marker Size and Color",
      },
      { label: "Stacked Funnel", prompt: "Stacked Funnel" },
      {
        label: "Time Series + Rangeslider",
        prompt: "Time Series with Rangeslider",
      },
      { label: "Basic Time Series", prompt: "Basic Time Series" },
    ],
  },
  {
    id: "3d",
    label: "3D Charts",
    icon: "◆",
    color: "#e879f9",
    description: "Three-dimensional visualizations",
    subtypes: [
      { label: "AI Choice", prompt: null },
      { label: "3D Scatter", prompt: "3D Scatter Plot" },
      { label: "Basic Ribbon Plot", prompt: "Basic Ribbon Plot" },
      { label: "3D Ribbon Plot", prompt: "Basic Ribbon Plot 3d" },
      {
        label: "Topographical Surface",
        prompt: "Topographical 3D Surface Plot",
      },
      { label: "Multiple 3D Surfaces", prompt: "Multiple 3D Surface Plots" },
      { label: "3D Mesh Plot", prompt: "Simple 3D Mesh Plot" },
      { label: "3D Line Chart", prompt: "3D line chart" },
      { label: "3D Mesh Tetrahedron", prompt: "3D Mesh Tetrahedron" },
      { label: "3D Line Plot", prompt: "3D Line Plot" },
      { label: "3D Line + Markers", prompt: "3D Line + Markers Plot" },
      { label: "3D Line Spiral", prompt: "3D Line Spiral Plot" },
      { label: "3D Random Walk", prompt: "3D Random Walk Plot" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChartTypeSelector({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [selected, setSelected] = useState(null); // { groupLabel, subLabel, prompt }
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setActiveGroup(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleGroupClick = (group) => {
    setActiveGroup(activeGroup?.id === group.id ? null : group);
  };

  const handleSubSelect = (group, sub) => {
    const sel =
      sub.prompt === null
        ? { groupLabel: group.label, subLabel: "AI Choice", prompt: null }
        : { groupLabel: group.label, subLabel: sub.label, prompt: sub.prompt };
    setSelected(sel);
    onSelect(sel);
    setOpen(false);
    setActiveGroup(null);
  };

  const handleGroupDirectSelect = (group, e) => {
    e.stopPropagation();
    const sel = {
      groupLabel: group.label,
      subLabel: "AI Choice",
      prompt: null,
      group: group.id,
    };
    setSelected(sel);
    onSelect(sel);
    setOpen(false);
    setActiveGroup(null);
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    setSelected(null);
    onSelect(null);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(!open);
          setActiveGroup(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.32rem 0.65rem",
          background: selected
            ? "rgba(56,189,248,0.1)"
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${selected ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: "8px",
          color: selected ? "#38bdf8" : "#2d4a6a",
          cursor: "pointer",
          fontSize: "0.75rem",
          fontFamily: "'DM Sans', sans-serif",
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: "0.8rem" }}>
              {CHART_GROUPS.find((g) => g.label === selected.groupLabel)?.icon}
            </span>
            <span
              style={{
                maxWidth: "90px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selected.subLabel === "AI Choice"
                ? selected.groupLabel
                : selected.subLabel}
            </span>
            <span
              onClick={clearSelection}
              style={{
                marginLeft: "2px",
                opacity: 0.5,
                fontSize: "0.7rem",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ✕
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: "0.9rem" }}>⬡</span>
            <span>Chart Type</span>
            <span
              style={{ fontSize: "0.6rem", opacity: 0.5, marginLeft: "1px" }}
            >
              ▾
            </span>
          </>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: "620px",
            maxWidth: "calc(100vw - 2rem)",
            background: "linear-gradient(145deg, #070d1a 0%, #050b14 100%)",
            border: "1px solid rgba(56,189,248,0.15)",
            borderRadius: "14px",
            boxShadow:
              "0 -8px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.05)",
            overflow: "hidden",
            zIndex: 9999,
            animation: "dropUp 0.18s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <style>{`
            @keyframes dropUp {
              from { opacity: 0; transform: translateY(8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateX(-6px); }
              to   { opacity: 1; transform: translateX(0); }
            }
            .ctype-group:hover { background: rgba(255,255,255,0.03) !important; }
            .ctype-sub:hover { background: rgba(56,189,248,0.08) !important; color: #e2e8f0 !important; }
            .ctype-arrow:hover { background: rgba(56,189,248,0.12) !important; }
          `}</style>

          {/* Header */}
          <div
            style={{
              padding: "0.75rem 1rem 0.6rem",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "0.7rem",
                color: "#1e3a5f",
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Select Chart Type
            </span>
            <span style={{ fontSize: "0.68rem", color: "#0f2035" }}>
              {CHART_GROUPS.length} categories ·{" "}
              {CHART_GROUPS.reduce((a, g) => a + g.subtypes.length - 1, 0)}{" "}
              types
            </span>
          </div>

          <div style={{ display: "flex", height: "320px" }}>
            {/* Left: group list */}
            <div
              style={{
                width: "200px",
                flexShrink: 0,
                borderRight: "1px solid rgba(255,255,255,0.04)",
                overflowY: "auto",
                padding: "0.5rem 0",
              }}
            >
              {CHART_GROUPS.map((group) => (
                <div
                  key={group.id}
                  className="ctype-group"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.55rem 0.85rem",
                    cursor: "pointer",
                    background:
                      activeGroup?.id === group.id
                        ? "rgba(56,189,248,0.07)"
                        : "transparent",
                    borderLeft:
                      activeGroup?.id === group.id
                        ? `2px solid ${group.color}`
                        : "2px solid transparent",
                    transition: "all 0.12s",
                  }}
                  onClick={() => handleGroupClick(group)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.55rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1rem",
                        color: group.color,
                        width: "18px",
                        textAlign: "center",
                        filter: `drop-shadow(0 0 4px ${group.color}55)`,
                      }}
                    >
                      {group.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color:
                            activeGroup?.id === group.id
                              ? "#e2e8f0"
                              : "#64748b",
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          lineHeight: 1.2,
                        }}
                      >
                        {group.label}
                      </div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          color: "#1e3a5f",
                          lineHeight: 1.3,
                          marginTop: "1px",
                        }}
                      >
                        {group.subtypes.length - 1} types
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.55rem",
                      color:
                        activeGroup?.id === group.id ? group.color : "#1e3a5f",
                      transition: "transform 0.15s",
                      transform:
                        activeGroup?.id === group.id ? "rotate(90deg)" : "none",
                    }}
                  >
                    ▶
                  </span>
                </div>
              ))}
            </div>

            {/* Right: subtypes or welcome */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
              {!activeGroup ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    opacity: 0.4,
                  }}
                >
                  <div style={{ fontSize: "2.5rem" }}>⬡</div>
                  <div
                    style={{
                      color: "#334155",
                      fontSize: "0.78rem",
                      textAlign: "center",
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.5,
                    }}
                  >
                    Select a category
                    <br />
                    to see chart subtypes
                  </div>
                </div>
              ) : (
                <div style={{ animation: "slideIn 0.15s ease both" }}>
                  {/* Group header */}
                  <div
                    style={{
                      padding: "0.4rem 0.5rem 0.6rem",
                      marginBottom: "0.25rem",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: activeGroup.color,
                        fontFamily: "'DM Mono', monospace",
                        letterSpacing: "0.08em",
                        marginBottom: "0.2rem",
                      }}
                    >
                      {activeGroup.icon} {activeGroup.label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#334155" }}>
                      {activeGroup.description}
                    </div>
                  </div>

                  {/* Subtypes grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "3px",
                    }}
                  >
                    {activeGroup.subtypes.map((sub, i) => (
                      <button
                        key={i}
                        className="ctype-sub"
                        onClick={() => handleSubSelect(activeGroup, sub)}
                        style={{
                          textAlign: "left",
                          padding: "0.5rem 0.65rem",
                          background:
                            sub.prompt === null
                              ? `rgba(${hexToRgb(activeGroup.color)},0.06)`
                              : "rgba(255,255,255,0.02)",
                          border:
                            sub.prompt === null
                              ? `1px solid rgba(${hexToRgb(activeGroup.color)},0.2)`
                              : "1px solid transparent",
                          borderRadius: "7px",
                          cursor: "pointer",
                          color:
                            sub.prompt === null ? activeGroup.color : "#475569",
                          fontSize: "0.74rem",
                          fontFamily: "'DM Sans', sans-serif",
                          transition: "all 0.1s",
                          gridColumn: sub.prompt === null ? "1 / -1" : "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        {sub.prompt === null ? (
                          <>
                            <span style={{ fontSize: "0.8rem" }}>✦</span>
                            <span style={{ fontWeight: 500 }}>
                              Let AI choose the best {activeGroup.label} type
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              style={{
                                width: "4px",
                                height: "4px",
                                borderRadius: "50%",
                                background: activeGroup.color,
                                flexShrink: 0,
                                opacity: 0.6,
                              }}
                            />
                            {sub.label}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.5rem 1rem",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.67rem", color: "#0f2035" }}>
              Click category → pick type → AI will generate that exact chart
            </span>
            <button
              onClick={() => {
                setOpen(false);
                setActiveGroup(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#1e3a5f",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontFamily: "inherit",
              }}
            >
              Close ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// hex → "r,g,b" for rgba()
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
