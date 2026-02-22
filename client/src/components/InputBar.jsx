import { useState, useRef } from "react";

export default function InputBar({ onSend, isLoading }) {
  const [input, setInput] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileName, setFileName] = useState("");
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
    onSend(input, fileContent, fileName);
    setInput("");
    clearFile();
  };

  return (
    <div className="input-area">
      <div className="input-wrap">
        {fileName && (
          <div className="file-pill">
            📎 {fileName}
            <button onClick={clearFile} className="file-remove">✕</button>
          </div>
        )}

        <div className="input-box">
          {/* Attach */}
          <label className="attach-btn" title="Attach file">
            <input
              ref={fileRef}
              type="file"
              accept="text/*,.csv,.json"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </label>

          {/* Text */}
          <input
            className="text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder='Describe a chart… e.g. "Show monthly sales for 2024 as a bar chart"'
          />

          {/* Send */}
          <button
            className={`send-btn ${input.trim() && !isLoading ? "active" : ""}`}
            onClick={send}
            disabled={!input.trim() || isLoading}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>

        <p className="input-hint">Powered by Gemini 1.5 Flash · Free tier · 1,500 req/day</p>
      </div>
    </div>
  );
}
