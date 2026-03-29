import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Key rotation ──────────────────────────────────────────────────────────────
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

// ── Context-aware system prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT_WITH_CONTEXT = `You are a chart assistant with context memory. You output JSON only.

PERSONALITY: Chill, witty, slightly sarcastic — like a smart friend who loves data viz. When you must reject something, react to what the user actually said. Be different every time.

YOUR JOB: Decide whether to EDIT the previous chart or CREATE a new one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN TO **EDIT** THE PREVIOUS CHART (modify existing):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User says things like:
• "make it blue" / "change the color to red"
• "add labels" / "remove the legend"
• "bigger text" / "smaller bars"
• "make it 3D" / "switch to a pie chart"
• "rotate it" / "flip the axes"
• "add a title" / "change the title to X"
• "show percentages" / "hide the grid"
• "animate it" / "add markers"
• "darker background" / "transparent"
• **ANY modification to the SAME dataset/concept**

→ Return: {"action": "edit", "data": [...], "layout": {...}}
→ Take the previous chart config and apply ONLY the requested change
→ Keep everything else the same (same data, same chart type unless explicitly changed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN TO **CREATE** A NEW CHART (fresh start):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User asks for:
• A completely different topic ("show me revenue trends" → "now do user engagement")
• A different dataset
• A new chart type with new data ("make a scatter plot of X vs Y")
• Anything where the SUBJECT changes, not just the styling
• User provides new CSV/file data → ALWAYS create a new chart from that data

→ Return: {"action": "create", "data": [...], "layout": {...}}
→ Generate completely new chart with the provided or fresh demo data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR CASES (only these two):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User says something unrelated to charts → {"error": "<witty in-character response>"}
2. File attached but unusable → {"error": "<human response asking for different file>"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHART JSON RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- paper_bgcolor and plot_bgcolor: "rgba(0,0,0,0)"
- font.color: "#e2e8f0"
- Always include title and axis labels
- For "create": use provided file data if present, otherwise invent realistic demo data
- For "edit": preserve the existing data unless user explicitly says to change it
- Make 3D charts with care to ensure good visuals

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User: "make a bar chart of sales"
→ {"action": "create", "data": [...], "layout": {...}}

User: "make it blue"
→ {"action": "edit", "data": [same data], "layout": {...colors changed to blue...}}

User: "add a title saying Q4 Results"
→ {"action": "edit", "data": [same], "layout": {...title: "Q4 Results"...}}

User: "now show me user engagement over time"
→ {"action": "create", "data": [new time series], "layout": {...}}

User: "rotate the labels"
→ {"action": "edit", "data": [same], "layout": {...xaxis tickangle: -45...}}

User: "visualize this" + CSV data attached
→ {"action": "create", "data": [parsed from CSV], "layout": {...}}
`;

// ── No-context system prompt (fallback) ───────────────────────────────────────
const SYSTEM_PROMPT_NO_CONTEXT = `You are a chart assistant. You only output JSON. Never output plain text.

PERSONALITY: Chill, witty, slightly sarcastic — like a smart friend who loves data viz.

WHEN TO MAKE A CHART (always do this):
- User asks for any chart type by name → generate realistic demo data and make it
- User provides data → visualize it
- User says something vague but chart-related → make your best guess

WHEN TO RETURN AN ERROR (only these two cases):
1. User says something completely unrelated to charts → {"error": "<witty response>"}
2. File attached but no usable data → {"error": "<human response>"}

Valid chart response — ONLY this JSON:
{"data": [...], "layout": {...}}

Chart JSON rules:
- paper_bgcolor and plot_bgcolor: "rgba(0,0,0,0)"
- font.color: "#e2e8f0"
- Always include title and axis labels
- Invent realistic, interesting demo data when none is provided
- Pick the best chart type; if user specifies one, use it
`;


// ── Chart route with context memory ──────────────────────────────────────────
app.post("/api/chart", async (req, res) => {
  const { prompt, fileContent, previousChart } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  // Decide which system prompt to use
  const hasContext = !!previousChart;
  const systemPrompt = hasContext
    ? SYSTEM_PROMPT_WITH_CONTEXT
    : SYSTEM_PROMPT_NO_CONTEXT;

  // ── Build the full user prompt ──────────────────────────────────────────────
  // FIX: fileContent is now always appended regardless of whether previousChart
  // exists. Previously, when hasContext=true the entire fileContent block was
  // skipped, so attached CSV/JSON files were silently ignored mid-conversation.
  let fullPrompt = "";

  if (hasContext) {
    fullPrompt = `━━━ PREVIOUS CHART CONTEXT ━━━
${JSON.stringify(previousChart, null, 2)}

━━━ USER REQUEST ━━━
${prompt}${fileContent ? `\n\n━━━ ATTACHED FILE DATA (use this to create a new chart) ━━━\n${fileContent}` : ""}`;
  } else {
    fullPrompt = fileContent
      ? `Visualize this data:\n\n${fileContent}\n\nInstruction: ${prompt}`
      : prompt;
  }

  // Try each key until success
  for (let attempt = 0; attempt < KEYS.length; attempt++) {
    const { key, index, allExhausted } = getNextAvailableKey();

    if (allExhausted) {
      return res.status(429).json({
        error:
          "All API keys are temporarily exhausted. Please wait a minute and try again.",
      });
    }

    console.log(`Attempt ${attempt + 1} using key #${index + 1}`);

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
              { role: "system", content: systemPrompt },
              { role: "user", content: fullPrompt },
            ],
            temperature: 0.9,
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
        console.error(`Key #${index + 1} error:`, err);
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

      // Handle error responses
      if (chartConfig.error) {
        console.log(`AI soft-rejected: ${chartConfig.error}`);
        return res.json(chartConfig);
      }

      // Validate chart structure
      if (!chartConfig.data || !chartConfig.layout) {
        throw new Error("Invalid chart config structure");
      }

      console.log(`Success with key #${index + 1}`);

      // Return the chart config with action type (if available)
      return res.json({
        action: chartConfig.action || "create",
        data: chartConfig.data,
        layout: chartConfig.layout,
      });
    } catch (err) {
      console.error("Chart generation error:", err);
      return res.status(500).json({
        error: err.message || "Failed to generate chart",
      });
    }
  }

  return res.status(429).json({
    error: "All API keys exhausted. Try again in a minute.",
  });
});

// ── Status route ──────────────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  const now = Date.now();
  res.json({
    totalKeys: KEYS.length,
    currentKeyIndex,
    keyStatus: KEYS.map((_, i) => ({
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

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`),
  );
}

export default app;
