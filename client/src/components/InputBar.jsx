import { useState, useRef } from "react";
import ChartTypeSelector from "./Charttypeselector";

export default function InputBar({ onSend, isLoading }) {
  const [input, setInput] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [chartType, setChartType] = useState(null); // { groupLabel, subLabel, prompt }
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setFileContent(await f.text());
  };

  const clearFile = () => {
    setFileContent("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = () => {
    if (!input.trim() || isLoading) return;

    // Build the final prompt — inject chart type if selected
    let finalPrompt = input;
    if (chartType) {
      if (chartType.prompt) {
        // Specific subtype — exact prompt words injected
        finalPrompt = `${input} — make this as a "${chartType.prompt}"`;
      } else {
        // AI choice within a group — tell AI the category
        finalPrompt = `${input} — make this as a ${chartType.groupLabel} chart (choose the best subtype)`;
      }
    }

    onSend(finalPrompt, fileContent, fileName);
    setInput("");
    clearFile();
    // Keep chart type selected so user can make multiple charts of same type
  };

  return (
    <div className="input-area">
      <div className="input-wrap">
        {fileName && (
          <div className="file-pill">
            📎 {fileName}
            <button onClick={clearFile} className="file-remove">
              ✕
            </button>
          </div>
        )}

        <div className="input-box">
          {/* Attach */}
          <label className="attach-btn" title="Attach CSV or JSON file">
            <input
              ref={fileRef}
              type="file"
              accept="text/*,.csv,.json"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </label>

          {/* Chart type selector */}
          <ChartTypeSelector onSelect={setChartType} />

          {/* Divider */}
          <div
            style={{
              width: "1px",
              height: "20px",
              background: "rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          />

          {/* Text */}
          <input
            className="text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              chartType
                ? `Describe your ${chartType.subLabel === "AI Choice" ? chartType.groupLabel : chartType.subLabel} chart…`
                : 'Describe a chart… e.g. "Monthly sales for 2024"'
            }
          />

          {/* Send */}
          <button
            className={`send-btn ${input.trim() && !isLoading ? "active" : ""}`}
            onClick={send}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
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
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            )}
          </button>
        </div>

        <p className="input-hint">
          Powered by Groq · llama-3.3-70b · Auto key rotation
        </p>
      </div>
    </div>
  );
}
