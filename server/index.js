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

// ── CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

// ── DB/Auth/User/Chart/Feedback Routes ────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/charts", chartRoutes);
app.use("/api/feedback", feedbackRoutes);

// ── Key Rotation ──────────────────────────────────────────────
const KEYS = [];
for (let i = 1; i <= 20; i++) {
  const k = process.env[`GROQ_KEY_${i}`];
  if (k) KEYS.push(k);
}
if (KEYS.length === 0 && process.env.GROQ_API_KEY) {
  KEYS.push(process.env.GROQ_API_KEY);
}
console.log(`Loaded ${KEYS.length} Groq API key(s)`);

let currentKeyIndex = 0;
const exhaustedUntil = {};

function getNextAvailableKey() {
  const now = Date.now();
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % KEYS.length;
    if (!exhaustedUntil[idx] || exhaustedUntil[idx] < now) {
      currentKeyIndex = idx;
      return { key: KEYS[idx], index: idx };
    }
  }
  // All exhausted — return soonest to recover
  let soonestIdx = 0;
  let soonestTime = Infinity;
  for (let i = 0; i < KEYS.length; i++) {
    if ((exhaustedUntil[i] || 0) < soonestTime) {
      soonestTime = exhaustedUntil[i] || 0;
      soonestIdx = i;
    }
  }
  return { key: KEYS[soonestIdx], index: soonestIdx, allExhausted: true };
}

function markKeyExhausted(index) {
  exhaustedUntil[index] = Date.now() + 60 * 1000;
  console.log(`Key #${index + 1} exhausted, switching...`);
  currentKeyIndex = (index + 1) % KEYS.length;
}

// ── AI System Prompts ─────────────────────────────────────────
const SYSTEM_PROMPT_WITH_CONTEXT = `You are a chart assistant with context memory. You output JSON only.

PERSONALITY: Chill, witty, slightly sarcastic — like a smart friend who loves data viz. When you must reject something, react to what the user actually said. Be different every time.

YOUR JOB: Decide whether to EDIT the previous chart or CREATE a new one.

WHEN TO EDIT THE PREVIOUS CHART:
User says things like: "make it blue", "change the color", "add labels", "remove the legend",
"bigger text", "smaller bars", "make it 3D", "switch to a pie chart", "rotate it",
"flip the axes", "add a title", "change the title to X", "show percentages", "hide the grid",
"animate it", "add markers", "darker background", "transparent",
or ANY modification to the SAME dataset/concept.
Return: {"action": "edit", "data": [...], "layout": {...}}
Take the previous chart config and apply ONLY the requested change. Keep everything else the same.

WHEN TO CREATE A NEW CHART:
User asks for a completely different topic, a different dataset, a new chart type with new data,
anything where the SUBJECT changes not just styling, or user provides new CSV/file data.
Return: {"action": "create", "data": [...], "layout": {...}}

ERROR CASES (only these two):
1. User says something unrelated to charts → {"error": "<witty in-character response>"}
2. File attached but unusable → {"error": "<human response asking for different file>"}

CHART JSON RULES:
- paper_bgcolor and plot_bgcolor must be "rgba(0,0,0,0)"
- font.color must be "#e2e8f0"
- Always include title and axis labels
- For "create": use provided file data if present, otherwise invent realistic demo data
- For "edit": preserve the existing data unless user explicitly says to change it`;

const SYSTEM_PROMPT_NO_CONTEXT = `You are a chart assistant. You only output JSON. Never output plain text.

PERSONALITY: Chill, witty, slightly sarcastic — like a smart friend who loves data viz.

WHEN TO MAKE A CHART:
- User asks for any chart type → generate realistic demo data and make it
- User provides data → visualize it
- User says something vague but chart-related → make your best guess
Return: {"data": [...], "layout": {...}}

WHEN TO RETURN AN ERROR (only these two cases):
1. User says something completely unrelated to charts → {"error": "<witty response>"}
2. File attached but no usable data → {"error": "<human response>"}

CHART JSON RULES:
- paper_bgcolor and plot_bgcolor must be "rgba(0,0,0,0)"
- font.color must be "#e2e8f0"
- Always include title and axis labels
- Invent realistic, interesting demo data when none is provided
- Pick the best chart type; if user specifies one, use it`;

// ── AI Chart Generation ───────────────────────────────────────
app.post("/api/chart", upload.single("file"), async (req, res) => {
  const { prompt, fileContent, previousChart } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  if (KEYS.length === 0) {
    return res.status(500).json({
      error:
        "No API keys configured. Add GROQ_KEY_1 through GROQ_KEY_N or GROQ_API_KEY to your .env",
    });
  }

  const hasContext = !!previousChart;
  const systemPrompt = hasContext
    ? SYSTEM_PROMPT_WITH_CONTEXT
    : SYSTEM_PROMPT_NO_CONTEXT;

  let fullPrompt = "";
  if (hasContext) {
    fullPrompt = `PREVIOUS CHART CONTEXT:\n${JSON.stringify(previousChart, null, 2)}\n\nUSER REQUEST:\n${prompt}${
      fileContent
        ? `\n\nATTACHED FILE DATA (use this to create a new chart):\n${fileContent}`
        : ""
    }`;
  } else {
    fullPrompt = fileContent
      ? `Visualize this data:\n\n${fileContent}\n\nInstruction: ${prompt}`
      : prompt;
  }

  for (let attempt = 0; attempt < KEYS.length; attempt++) {
    const { key, index, allExhausted } = getNextAvailableKey();

    if (allExhausted) {
      return res.status(429).json({
        error:
          "All API keys are temporarily exhausted. Please wait a minute and try again.",
      });
    }

    console.log(`Attempt ${attempt + 1} using key #${index + 1}`);

    let response;
    try {
      response = await fetch(
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
            temperature: 0.9,
            max_tokens: 4096,
            response_format: { type: "json_object" },
          }),
        },
      );
    } catch (fetchErr) {
      console.warn(`Key #${index + 1} fetch failed: ${fetchErr.message}`);
      markKeyExhausted(index);
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

    if (!response.ok) {
      const err = await response.text();
      console.error(`Key #${index + 1} error:`, err);
      return res.status(500).json({ error: "Groq API failed", detail: err });
    }

    let groqData;
    try {
      groqData = await response.json();
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse Groq response" });
    }

    const raw = groqData?.choices?.[0]?.message?.content;
    if (!raw) {
      return res.status(500).json({ error: "Empty response from Groq" });
    }

    let chartConfig;
    try {
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      chartConfig = JSON.parse(cleaned);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Failed to parse chart JSON from AI response" });
    }

    // Soft error from AI (unrelated prompt etc.)
    if (chartConfig.error) {
      console.log(`AI soft-rejected: ${chartConfig.error}`);
      return res.json(chartConfig);
    }

    if (!chartConfig.data || !chartConfig.layout) {
      return res
        .status(500)
        .json({ error: "AI returned invalid chart structure" });
    }

    console.log(`✓ Success with key #${index + 1}`);
    return res.json({
      action: chartConfig.action || "create",
      data: chartConfig.data,
      layout: chartConfig.layout,
    });
  }

  return res
    .status(429)
    .json({ error: "All API keys exhausted. Try again in a minute." });
});

// ── Key Status (visit this URL to see key health) ─────────────
// Local:   http://localhost:3001/api/status
// Vercel:  https://your-app.vercel.app/api/status
app.get("/api/status", (req, res) => {
  const now = Date.now();
  res.json({
    totalKeys: KEYS.length,
    currentKeyIndex,
    keys: KEYS.map((_, i) => ({
      key: `Key #${i + 1}`,
      status:
        exhaustedUntil[i] && exhaustedUntil[i] > now
          ? "exhausted"
          : "available",
      resetsIn:
        exhaustedUntil[i] && exhaustedUntil[i] > now
          ? `${Math.ceil((exhaustedUntil[i] - now) / 1000)}s`
          : "ready",
    })),
  });
});

// ── Start server (skipped on Vercel — uses export default) ────
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () =>
    console.log(`✅ Server running on http://localhost:${PORT}`),
  );
}

export default app;
