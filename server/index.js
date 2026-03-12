import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ── Key pool ──────────────────────────────────────────────────────────────────
const KEYS = [];
for (let i = 1; i <= 20; i++) {
  const k = process.env[`GROQ_KEY_${i}`];
  if (k) KEYS.push(k.trim());
}
if (KEYS.length === 0 && process.env.GROQ_API_KEY) {
  KEYS.push(process.env.GROQ_API_KEY.trim());
}
console.log(`Loaded ${KEYS.length} Groq API key(s)`);

// Per-key state
const keyState = KEYS.map(() => ({
  exhaustedUntil: 0, // timestamp
  failures: 0, // consecutive failures
}));

let rrIndex = 0; // round-robin pointer

/** Return the index of the next usable key, or -1 if all exhausted */
function pickKey() {
  const now = Date.now();
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (rrIndex + i) % KEYS.length;
    if (keyState[idx].exhaustedUntil <= now) {
      rrIndex = (idx + 1) % KEYS.length; // advance pointer past this one
      return idx;
    }
  }
  return -1; // all exhausted
}

function exhaustKey(idx, seconds = 62) {
  keyState[idx].exhaustedUntil = Date.now() + seconds * 1000;
  keyState[idx].failures++;
  console.warn(
    `Key #${idx + 1} exhausted for ${seconds}s (failures: ${keyState[idx].failures})`,
  );
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Generate a Plotly.js chart config as raw JSON only.
Rules:
- Output ONLY valid JSON with "data" array and "layout" object
- plot_bgcolor and paper_bgcolor: "rgba(0,0,0,0)"
- font color: "#e2e8f0"
- Use realistic data, proper titles and axis labels
- Make it visually beautiful with rgba colors`;

// ── Fetch with timeout ────────────────────────────────────────────────────────
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

// ── Chart route ───────────────────────────────────────────────────────────────
app.post("/api/chart", async (req, res) => {
  const { prompt, fileContent } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  const fullPrompt = fileContent
    ? `Analyze this data and create the best possible visualization:\n\n${fileContent}\n\nUser instruction: ${prompt}`
    : `Create a professional, data-rich chart for: ${prompt}`;

  const maxAttempts = KEYS.length * 2; // allow cycling through all keys twice

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idx = pickKey();

    if (idx === -1) {
      // All keys exhausted — find soonest reset
      const soonest = Math.min(...keyState.map((s) => s.exhaustedUntil));
      const waitMs = Math.max(0, soonest - Date.now());
      console.log(
        `All keys exhausted. Waiting ${Math.ceil(waitMs / 1000)}s...`,
      );
      await new Promise((r) => setTimeout(r, waitMs + 500));
      continue;
    }

    console.log(`Attempt ${attempt + 1}/${maxAttempts} — key #${idx + 1}`);

    let response;
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

    // Rate limited or auth error → rotate key
    if (response.status === 429) {
      // Parse retry-after if present
      const retryAfter = parseInt(
        response.headers.get("retry-after") || "62",
        10,
      );
      exhaustKey(idx, retryAfter + 2);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      exhaustKey(idx, 3600); // bad key — long cooldown
      console.error(`Key #${idx + 1} is invalid (${response.status})`);
      continue;
    }

    if (
      response.status === 503 ||
      response.status === 502 ||
      response.status === 504
    ) {
      exhaustKey(idx, 15);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      console.error(`Key #${idx + 1} unexpected ${response.status}:`, errText);
      // Don't retry on 400 (bad request) — that's a prompt issue
      if (response.status === 400) {
        return res
          .status(400)
          .json({ error: "Bad request to Groq", detail: errText });
      }
      exhaustKey(idx, 30);
      continue;
    }

    // ── Parse response ────────────────────────────────────────────────────────
    let groqData;
    try {
      groqData = await response.json();
    } catch {
      console.warn(`Key #${idx + 1} returned non-JSON body`);
      exhaustKey(idx, 10);
      continue;
    }

    const raw = groqData?.choices?.[0]?.message?.content;
    if (!raw) {
      console.warn(`Key #${idx + 1} returned empty content`);
      exhaustKey(idx, 10);
      continue;
    }

    // ── Clean & parse chart JSON ──────────────────────────────────────────────
    let chartConfig;
    try {
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      chartConfig = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn(`Key #${idx + 1} returned invalid JSON:`, raw.slice(0, 200));
      // Don't exhaust the key — this is a model output issue, retry with same pool
      // but mark a short cooldown to avoid hammering
      exhaustKey(idx, 5);
      continue;
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

// ── Status route ──────────────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  const now = Date.now();
  res.json({
    totalKeys: KEYS.length,
    keys: keyState.map((s, i) => ({
      id: `Key #${i + 1}`,
      status: s.exhaustedUntil > now ? "exhausted" : "available",
      resetsIn:
        s.exhaustedUntil > now
          ? `${Math.ceil((s.exhaustedUntil - now) / 1000)}s`
          : "ready",
      failures: s.failures,
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
