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

let rrIndex = 0; // round-robin pointer

/** Return the index of the next usable key, or -1 if all exhausted */
function pickKey() {
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
      response = await fetchWithTimeout(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KEYS[idx]}`,
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
        25000, // 25s timeout per key attempt
      );
    } catch (fetchErr) {
      // Network error or timeout — mark key and retry
      console.warn(`Key #${idx + 1} fetch failed: ${fetchErr.message}`);
      exhaustKey(idx, 30); // shorter cooldown for network errors
      continue;
    }

      if (
        response.status === 429 ||
        response.status === 401 ||
        response.status === 400
      ) {
        markKeyExhausted(index);
        continue;
      }
      exhaustKey(idx, 30);
      continue;
    }

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: "Groq API failed", detail: err });
      }

      const groqData = await response.json();
      const raw = groqData?.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Empty response from Groq");

    // ── Clean & parse chart JSON ──────────────────────────────────────────────
    let chartConfig;
    try {
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

    if (!chartConfig.data || !chartConfig.layout) {
      console.warn(`Key #${idx + 1} returned wrong structure`);
      exhaustKey(idx, 5);
      continue;
    }

    console.log(`✓ Success with key #${idx + 1} on attempt ${attempt + 1}`);
    // Reset failure count on success
    keyState[idx].failures = 0;
    return res.json(chartConfig);
  }

  return res.status(503).json({
    error:
      "All API keys exhausted after maximum retries. Please wait a minute.",
  });
});

// ── Status ────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`✅ Graphix server running on http://localhost:${PORT}`),
);
