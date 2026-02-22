import { useEffect, useRef } from "react";

export default function ChatArea({ messages }) {
  return (
    <div className="messages">
      {messages.map((msg, idx) => (
        <div key={msg.id} className="msg-row" style={{ animationDelay: `${idx * 0.03}s` }}>
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

  useEffect(() => {
    if (message.status !== "success" || rendered.current || !divRef.current) return;
    if (!window.Plotly) return;
    rendered.current = true;
    try {
      window.Plotly.newPlot(
        divRef.current,
        message.content.data,
        {
          ...message.content.layout,
          autosize: true,
          margin: { t: 50, l: 55, r: 30, b: 50 },
        },
        { responsive: true, displayModeBar: false }
      );
    } catch (e) {
      console.error("Plotly render error:", e);
    }
  }, [message.status]);

  if (message.status === "loading") {
    return (
      <div className="chart-loading">
        <div className="dots">
          {[0,1,2,3].map((i) => <span key={i} style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
        <p>Generating visualization…</p>
      </div>
    );
  }

  if (message.status === "error") {
    return <div className="chart-error">⚠ {message.content}</div>;
  }

  return (
    <div className="chart-card">
      <div ref={divRef} style={{ width: "100%", height: 420 }} />
    </div>
  );
}
