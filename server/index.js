import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";

import authRoutes from "../routes/auth.js";
import userRoutes from "../routes/user.js";
import chartRoutes from "../routes/charts.js";
import feedbackRoutes from "../routes/feedback.js";

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

// ── Key management ────────────────────────────────────────────
const KEYS = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const exhaustedUntil = {};
let currentKeyIndex = 0;

function pickKey() {
  const now = Date.now();
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % KEYS.length;
    if (!exhaustedUntil[idx] || exhaustedUntil[idx] <= now) {
      currentKeyIndex = (idx + 1) % KEYS.length;
      return { key: KEYS[idx], index: idx };
    }
  }
  return { key: null, index: -1 };
}

function markKeyExhausted(index, ms = 60000) {
  exhaustedUntil[index] = Date.now() + ms;
  console.warn(`Key #${index + 1} exhausted. Retry after ${ms / 1000}s.`);
}

async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT = `You are a professional data visualization expert. Generate Plotly.js chart configurations.
Always respond with valid JSON containing exactly two keys: "data" (array of trace objects) and "layout" (layout object).
Use professional color schemes. Make charts visually appealing with proper titles, labels, and formatting.`;

// ── AI Chart Generation ───────────────────────────────────────
app.post("/api/chart", upload.single("file"), async (req, res) => {
  const { prompt, fileContent, previousChart } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  if (KEYS.length === 0) {
    return res.status(500).json({ error: "No API keys configured." });
  }

  // Build system prompt with optional edit context
  let systemPrompt = SYSTEM_PROMPT;
  if (previousChart) {
    systemPrompt += `\n\nThe user has an existing chart. If they ask to modify/edit/update it, respond with the modified chart JSON and include an "action": "edit" field at the top level. If they want a new chart, omit the action field.\n\nExisting chart: ${JSON.stringify(previousChart)}`;
  }

  const fullPrompt = fileContent
    ? `Analyze this data and create the best possible visualization:\n\n${fileContent}\n\nUser instruction: ${prompt}`
    : `Create a professional, data-rich chart for: ${prompt}`;

  for (let attempt = 0; attempt < KEYS.length; attempt++) {
    const { key, index } = pickKey();

    if (!key) {
      return res.status(429).json({
        error: "All API keys temporarily exhausted. Please wait a minute.",
      });
    }

    let response;
    try {
      response = await fetchWithTimeout(
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
              { role: "system", content: systemPrompt },
              { role: "user", content: fullPrompt },
            ],
            temperature: 0.6,
            max_tokens: 4096,
            response_format: { type: "json_object" },
          }),
        },
        25000,
      );
    } catch (fetchErr) {
      console.warn(`Key #${index + 1} fetch failed: ${fetchErr.message}`);
      markKeyExhausted(index, 30000);
      continue;
    }

    if (response.status === 429 || response.status === 401) {
      markKeyExhausted(index);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", errText);
      return res
        .status(500)
        .json({ error: "Groq API failed", detail: errText });
    }

    try {
      const groqData = await response.json();
      const raw = groqData?.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Empty response from Groq");

      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const chartConfig = JSON.parse(cleaned);

      if (!chartConfig.data || !chartConfig.layout) {
        throw new Error("Invalid chart config structure");
      }

      console.log(`✓ Success with key #${index + 1} on attempt ${attempt + 1}`);
      return res.json(chartConfig);
    } catch (parseErr) {
      console.error("Parse error:", parseErr.message);
      return res
        .status(500)
        .json({ error: parseErr.message || "Failed to parse chart response" });
    }
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
