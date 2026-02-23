import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// DEBUG ROUTE - remove after confirming it works
app.get("/api/test", (req, res) => {
  res.json({ key: process.env.GROQ_API_KEY ? "found" : "missing" });
});

const SYSTEM_PROMPT = `You are an expert data visualization engineer specializing in Plotly.js.
Your job is to generate stunning, professional, and insightful Plotly chart configurations.

OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown, no backticks, no explanation, no comments.
- Always include "data" (array) and "layout" (object) at the top level.
- JSON must be complete. Never truncate.

CHART QUALITY RULES:
- Always use REALISTIC and MEANINGFUL data. Never use placeholder values like [1,2,3].
- If the user asks for "sales data", generate realistic sales figures with proper trends.
- If the user asks for "population", use real approximate world population data.
- Make data tell a story — include trends, peaks, patterns that make sense.
- Use at least 8-12 data points for time series charts.
- For comparisons, use at least 4-6 categories.

VISUAL DESIGN RULES:
- Background: plot_bgcolor and paper_bgcolor must always be "rgba(0,0,0,0)".
- Font color: "#e2e8f0" for all text.
- Grid lines: "rgba(255,255,255,0.06)" subtle, not distracting.
- Always add a descriptive title using layout.title.text.
- Always label axes with layout.xaxis.title and layout.yaxis.title.
- Use a color palette that feels premium. Good palettes:
    Blues:   ["rgba(56,189,248,0.8)", "rgba(14,165,233,0.8)", "rgba(2,132,199,0.8)"]
    Greens:  ["rgba(52,211,153,0.8)", "rgba(16,185,129,0.8)", "rgba(5,150,105,0.8)"]
    Mixed:   ["rgba(56,189,248,0.8)", "rgba(52,211,153,0.8)", "rgba(251,191,36,0.8)", "rgba(244,114,182,0.8)", "rgba(167,139,250,0.8)"]
    Warm:    ["rgba(251,191,36,0.8)", "rgba(245,158,11,0.8)", "rgba(239,68,68,0.8)"]
- Always add border lines to bars/markers with slightly brighter version of fill color.
- For line charts: use smooth curves with mode "lines+markers", add fill "tozeroy" with low opacity.
- For bar charts: add subtle corner radius effect via marker.line.
- For pie/donut charts: use pull: [0.05] on the largest slice, add hole: 0.4 for donut effect.
- For scatter: vary marker sizes based on a third dimension if possible.
- Always add layout.legend with proper styling.
- Add layout.hoverlabel for styled tooltips.

CHART TYPE SELECTION:
- Time series data → line chart with area fill
- Comparisons between categories → horizontal bar chart (easier to read)
- Part of a whole → donut chart
- Correlation between two variables → scatter plot with sized markers
- Distribution → histogram or box plot
- Multiple metrics over time → multi-line chart with different y-axes if scales differ
- Geographic data → use bar chart sorted by value
- Rankings → horizontal bar chart sorted descending

ADVANCED FEATURES TO ALWAYS INCLUDE:
- layout.hovermode: "x unified" for time series, "closest" for others
- layout.margin: {"t": 60, "l": 60, "r": 40, "b": 60}
- layout.font: {"family": "DM Sans, sans-serif", "color": "#e2e8f0", "size": 13}
- layout.title.font: {"size": 18, "color": "#f1f5f9"}
- layout.xaxis.tickfont and layout.yaxis.tickfont: {"color": "#64748b"}
- layout.xaxis.linecolor and layout.yaxis.linecolor: "rgba(255,255,255,0.1)"
- For multi-trace charts: always include layout.legend with bgcolor "rgba(0,0,0,0.3)" and bordercolor "rgba(255,255,255,0.1)"`;

app.post("/api/chart", async (req, res) => {
  const { prompt, fileContent } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Invalid prompt" });
  }

  const fullPrompt = fileContent
    ? `Analyze this data and create the best possible visualization for it:\n\n${fileContent}\n\nUser instruction: ${prompt}`
    : `Create a professional, data-rich chart for: ${prompt}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
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
      },
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq error:", err);
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

    if (!chartConfig.data || !chartConfig.layout) {
      throw new Error("Invalid chart config structure");
    }

    return res.json(chartConfig);
  } catch (err) {
    console.error("Chart generation error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to generate chart" });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`),
  );
}

export default app;
