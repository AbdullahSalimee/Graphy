import { useEffect, useRef, useState } from "react";

const isMobile = () => window.innerWidth < 640;

function buildLayout(baseLayout) {
  const mobile = isMobile();
  return {
    ...baseLayout,
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      color: "#94a3b8",
      size: mobile ? 10 : 12,
      family: "DM Sans, sans-serif",
    },
    // On mobile: legend goes BELOW chart horizontally so it doesn't eat chart space
    legend: mobile
      ? {
          orientation: "h",
          x: 0,
          y: -0.28,
          font: { size: 10, color: "#94a3b8" },
          bgcolor: "rgba(0,0,0,0)",
        }
      : {
          ...(baseLayout.legend || {}),
          bgcolor: "rgba(7,13,26,0.85)",
          bordercolor: "rgba(56,189,248,0.15)",
          borderwidth: 1,
          font: { size: 12, color: "#94a3b8" },
        },
    // Tight margins on mobile so chart uses full width
    margin: mobile
      ? { t: 40, l: 46, r: 10, b: 70 }
      : { t: 50, l: 55, r: 30, b: 50 },
    title: baseLayout.title
      ? {
          ...(typeof baseLayout.title === "string"
            ? { text: baseLayout.title }
            : baseLayout.title),
          font: {
            size: mobile ? 13 : 18,
            color: "#e2e8f0",
            family: "Playfair Display, serif",
          },
          x: 0.5,
          xanchor: "center",
        }
      : undefined,
    xaxis: {
      ...(baseLayout.xaxis || {}),
      tickangle: mobile ? -40 : 0,
      tickfont: { size: mobile ? 9 : 11, color: "#64748b" },
      gridcolor: "rgba(56,189,248,0.07)",
      linecolor: "rgba(56,189,248,0.12)",
      zerolinecolor: "rgba(56,189,248,0.12)",
      automargin: true,
    },
    yaxis: {
      ...(baseLayout.yaxis || {}),
      tickfont: { size: mobile ? 9 : 11, color: "#64748b" },
      gridcolor: "rgba(56,189,248,0.07)",
      linecolor: "rgba(56,189,248,0.12)",
      zerolinecolor: "rgba(56,189,248,0.12)",
      automargin: true,
    },
  };
}

export default function ChatArea({ messages }) {
  return (
    <div className="messages">
      {messages.map((msg, idx) => (
        <div
          key={msg.id}
          className="msg-row"
          style={{ animationDelay: `${idx * 0.03}s` }}
        >
          {msg.from === "user" ? (
            <div className="user-bubble">
              {msg.hasFile && (
                <div className="file-badge">
                  📎 {msg.fileName || "Attached file"}
                </div>
              )}
              {msg.content}
            </div>
          ) : (
            <div className="ai-block">
              <ChartBlock message={msg} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartBlock({ message }) {
  const divRef = useRef(null);
  const rendered = useRef(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (message.status !== "success" || rendered.current || !divRef.current)
      return;

    const tryRender = () => {
      if (!window.Plotly) {
        setTimeout(tryRender, 100);
        return;
      }
      if (rendered.current || !divRef.current) return;
      rendered.current = true;

      try {
        const layout = buildLayout(message.content.layout || {});
        const mobile = isMobile();

        // Slim down traces slightly on mobile
        const data = (message.content.data || []).map((trace) => ({
          ...trace,
          ...(mobile && trace.type !== "pie" && trace.type !== "bar"
            ? {
                line: {
                  ...(trace.line || {}),
                  width: Math.min(trace.line?.width || 2, 1.5),
                },
                marker: {
                  ...(trace.marker || {}),
                  size: Math.min(trace.marker?.size || 8, 5),
                },
              }
            : {}),
        }));

        window.Plotly.newPlot(divRef.current, data, layout, {
          responsive: true,
          displayModeBar: false,
          scrollZoom: false,
        });
      } catch (e) {
        console.error("Plotly render error:", e);
      }
    };

    tryRender();
  }, [message.status]);

  // Reflow on orientation change
  useEffect(() => {
    const onResize = () => {
      if (divRef.current && window.Plotly && rendered.current) {
        window.Plotly.relayout(
          divRef.current,
          buildLayout(message.content?.layout || {}),
        );
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [message.content]);

  const handleDownload = async () => {
    if (!divRef.current || !window.Plotly) return;
    setDownloading(true);
    try {
      const title = message.content?.layout?.title?.text || "chart";
      const safeName = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await window.Plotly.downloadImage(divRef.current, {
        format: "png",
        width: 1400,
        height: 800,
        filename: safeName,
      });
    } catch (e) {
      console.error("Download error:", e);
    } finally {
      setDownloading(false);
    }
  };

  if (message.status === "loading") {
    return (
      <div className="chart-loading">
        <div className="dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <p>Generating visualization…</p>
      </div>
    );
  }

  if (message.status === "error") {
    return <div className="chart-error">⚠ {message.content}</div>;
  }

  const chartTitle =
    message.content?.layout?.title?.text ||
    (typeof message.content?.layout?.title === "string"
      ? message.content.layout.title
      : "Chart");

  return (
    <div className="chart-card">
      <div className="chart-card-toolbar">
        <span className="chart-card-title">{chartTitle}</span>
        <button
          className={`download-btn ${downloading ? "downloading" : ""}`}
          onClick={handleDownload}
          disabled={downloading}
          title="Download as PNG"
        >
          {downloading ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          <span>{downloading ? "Saving…" : "PNG"}</span>
        </button>
      </div>
      <div ref={divRef} className="chart-plot" />
    </div>
  );
}
