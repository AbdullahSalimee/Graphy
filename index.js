import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import chartRoutes from "./routes/charts.js";
import feedbackRoutes from "./routes/feedback.js";

const app = express();
const upload = multer();

// ── CORS ─────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));

// ── API Routes ────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/charts", chartRoutes);
app.use("/api/feedback", feedbackRoutes);

// ── AI Chart Generation (Groq) ────────────────────────────────
const KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let currentKeyIndex = 0;
const exhaustedUntil = {};

function getNextAvailableKey() {
  const now = Date.now();
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % KEYS.length;
    if (!exhaustedUntil[idx] || exhaustedUntil[idx] <= now) {
      currentKeyIndex = (idx + 1) % KEYS.length;
      return { key: KEYS[idx], index: idx, allExhausted: false };
    }
  }
  return { key: null, index: -1, allExhausted: true };
}

function markKeyExhausted(index) {
  exhaustedUntil[index] = Date.now() + 60_000;
  console.warn(`Key #${index + 1} exhausted. Retry after 60s.`);
}

const SYSTEM_PROMPT = `You are a professional data visualization expert. Generate Plotly.js chart configurations.
Always respond with valid JSON containing exactly two keys: "data" (array of trace objects) and "layout" (layout object).
Use professional color schemes. Make charts visually appealing with proper titles, labels, and formatting.`;

app.post("/api/chart", upload.single("file"), async (req, res) => {
  const { prompt, fileContent } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const fullPrompt = fileContent
    ? `Analyze this data and create the best possible visualization:\n\n${fileContent}\n\nUser instruction: ${prompt}`
    : `Create a professional, data-rich chart for: ${prompt}`;

  for (let attempt = 0; attempt < KEYS.length; attempt++) {
    const { key, index, allExhausted } = getNextAvailableKey();
    if (allExhausted) {
      return res
        .status(429)
        .json({
          error: "All API keys temporarily exhausted. Please wait a minute.",
        });
    }

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: fullPrompt },
            ],
            temperature: 0.6,
            max_tokens: 4096,
            response_format: { type: "json_object" },
          }),
        },
      );

      if (
        response.status === 429 ||
        response.status === 401 ||
        response.status === 400
      ) {
        markKeyExhausted(index);
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: "Groq API failed", detail: err });
      }

      const groqData = await response.json();
      const raw = groqData?.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Empty response from Groq");

      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const chartConfig = JSON.parse(cleaned);

      if (!chartConfig.data || !chartConfig.layout)
        throw new Error("Invalid chart config structure");

      return res.json(chartConfig);
    } catch (err) {
      console.error("Chart generation error:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to generate chart" });
    }
  }

  return res
    .status(429)
    .json({ error: "All API keys exhausted. Try again in a minute." });
});

// ── Status ────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`✅ Graphix server running on http://localhost:${PORT}`),
);
