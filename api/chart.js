const SYSTEM_PROMPT = `You are an expert data visualization engineer specializing in Plotly.js.
Your job is to generate stunning, professional, and insightful Plotly chart configurations.

OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments.
- Always include "data" (array) and "layout" (object) at the top level.
- JSON must be complete. Never truncate.

CHART QUALITY RULES:
- Always use REALISTIC and MEANINGFUL data. Never use placeholder values like [1,2,3].
- Make data tell a story — include trends, peaks, patterns that make sense.
- Use at least 8-12 data points for time series charts.

VISUAL DESIGN RULES:
- Background: plot_bgcolor and paper_bgcolor must always be "rgba(0,0,0,0)".
- Font color: "#e2e8f0" for all text.
- Grid lines: "rgba(255,255,255,0.06)".
- Always add a descriptive title, labeled axes.
- Use premium rgba color palettes with transparency.
- For line charts: smooth curves with fill "tozeroy".
- For pie/donut: add hole: 0.4.
- Always add layout.hoverlabel for styled tooltips.

ADVANCED:
- layout.hovermode: "x unified" for time series, "closest" for others
- layout.margin: {"t":60,"l":60,"r":40,"b":60}
- layout.font: {"family":"DM Sans, sans-serif","color":"#e2e8f0","size":13}
- layout.hoverlabel: {"bgcolor":"#1e293b","bordercolor":"rgba(56,189,248,0.3)","font":{"color":"#e2e8f0"}}`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, fileContent } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  const fullPrompt = fileContent
    ? `Analyze this data and create the best possible visualization:\n\n${fileContent}\n\nUser instruction: ${prompt}`
    : `Create a professional, data-rich chart for: ${prompt}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
      return res.status(500).json({ error: "Groq API failed" });
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

    if (!chartConfig.data || !chartConfig.layout) {
      throw new Error("Invalid chart config structure");
    }

    return res.status(200).json(chartConfig);
  } catch (err) {
    console.error("Chart generation error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate chart" });
  }
}
