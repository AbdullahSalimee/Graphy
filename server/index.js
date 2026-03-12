import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Chart assistant. JSON only, never plain text.

Vibe: witty, chill. When rejecting, react to exactly what they said — different every time.

MAKE a chart when: user names a chart type, provides data, or asks anything chart-related. Invent demo data if none given.
ERROR only when: (1) completely off-topic with zero chart intent, (2) attached file has no usable data.

Error format: {"error":"<your response>"}
Chart format: {"data":[...],"layout":{...}}

Layout rules: paper_bgcolor/plot_bgcolor="rgba(0,0,0,0)", font.color="#e2e8f0", always add title + axis labels.

After every fun/witty rejection, end with a short nudge like: 'Try: make a bar chart on global warming' or 'Got data? Drop it here.' — vary it every time.`;
// ── Chart route ───────────────────────────────────────────────────────────────
app.post("/api/chart", async (req, res) => {
  const { prompt, fileContent } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  const fullPrompt = fileContent
    ? `Visualize this data:\n\n${fileContent}\n\nInstruction: ${prompt}`
    : prompt;

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
              { role: "system", content: SYSTEM_PROMPT },
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

      if (chartConfig.error) {
        console.log(`AI soft-rejected: ${chartConfig.error}`);
        return res.json(chartConfig);
      }

      if (!chartConfig.data || !chartConfig.layout) {
        throw new Error("Invalid chart config structure");
      }

      console.log(`Success with key #${index + 1}`);
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
