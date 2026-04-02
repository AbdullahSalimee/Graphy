import { Router } from "express";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

/** Shape a raw saved_charts DB row into the full frontend SavedChart object */
function shapeChart(c) {
  return {
    id: c.id,
    title: c.title,
    prompt: c.prompt,
    chartConfig: c.chart_config,
    // display fields
    tag: c.tag,
    category: c.category,
    desc: c.description,
    views: c.views,
    trend: c.trend,
    up: c.trend_up,
    starred: c.starred,
    data: Array.isArray(c.sparkline) ? c.sparkline : [],
    updated: timeAgo(c.updated_at),
    // raw timestamps
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

/** Write an activity_log row — never throws, failures are soft */
async function logActivity(userId, action, chartId, chartTitle) {
  try {
    const userRow = await pool.query("SELECT avatar FROM users WHERE id = $1", [
      userId,
    ]);
    const avatar = userRow.rows[0]?.avatar ?? "U";
    await pool.query(
      `INSERT INTO activity_log (user_id, action, chart_id, chart_title, avatar)
         VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, chartId ?? null, chartTitle, avatar],
    );
  } catch (err) {
    console.error("Activity log error:", err);
  }
}

// ── POST /api/charts ──────────────────────────────────────────
// Create a new chart. Accepts all display fields from the frontend.
router.post("/", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const {
    title,
    prompt,
    chartConfig,
    // display fields — optional, defaults applied in DB
    tag = "Line",
    category = "General",
    description = "",
    trend = "0%",
    trendUp = true,
    sparkline = [],
  } = req.body;

  if (!chartConfig) {
    return res.status(400).json({ error: "chartConfig is required." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO saved_charts
         (user_id, title, prompt, chart_config,
          tag, category, description,
          trend, trend_up, sparkline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
         id, title, prompt, chart_config,
         tag, category, description,
         views, trend, trend_up, starred, sparkline,
         created_at, updated_at`,
      [
        userId,
        title || "Untitled Chart",
        prompt || "",
        chartConfig,
        tag,
        category,
        description,
        trend,
        trendUp,
        JSON.stringify(sparkline),
      ],
    );

    const chart = shapeChart(rows[0]);

    // Log activity
    await logActivity(userId, "Created", chart.id, chart.title);

    return res.status(201).json(chart);
  } catch (err) {
    console.error("Save chart error:", err);
    return res.status(500).json({ error: "Failed to save chart." });
  }
});

// ── GET /api/charts/:id ───────────────────────────────────────
// Fetch a single chart + increment view counter
router.get("/:id", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;

  try {
    // Increment views first (fire-and-forget is fine but we await to keep it simple)
    await pool.query(
      `UPDATE saved_charts SET views = views + 1
         WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    const { rows } = await pool.query(
      `SELECT
         id, title, prompt, chart_config,
         tag, category, description,
         views, trend, trend_up, starred, sparkline,
         created_at, updated_at
       FROM saved_charts
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Chart not found." });
    }

    return res.json(shapeChart(rows[0]));
  } catch (err) {
    console.error("Get chart error:", err);
    return res.status(500).json({ error: "Failed to fetch chart." });
  }
});

// ── PATCH /api/charts/:id ─────────────────────────────────────
// Update any combination of fields. All fields optional — only
// provided ones are updated (COALESCE pattern).
router.patch("/:id", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;
  const {
    title,
    tag,
    category,
    description,
    trend,
    trendUp,
    starred,
    sparkline,
    chartConfig,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE saved_charts
         SET
           title        = COALESCE($3,  title),
           tag          = COALESCE($4,  tag),
           category     = COALESCE($5,  category),
           description  = COALESCE($6,  description),
           trend        = COALESCE($7,  trend),
           trend_up     = COALESCE($8,  trend_up),
           starred      = COALESCE($9,  starred),
           sparkline    = COALESCE($10, sparkline),
           chart_config = COALESCE($11, chart_config),
           updated_at   = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING
           id, title, prompt, chart_config,
           tag, category, description,
           views, trend, trend_up, starred, sparkline,
           created_at, updated_at`,
      [
        id,
        userId,
        title ?? null,
        tag ?? null,
        category ?? null,
        description ?? null,
        trend ?? null,
        trendUp ?? null,
        starred ?? null,
        sparkline ? JSON.stringify(sparkline) : null,
        chartConfig ?? null,
      ],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Chart not found or not yours." });
    }

    const chart = shapeChart(rows[0]);

    // Only log "Edited" — star toggles have their own dedicated route below
    if (starred === undefined) {
      await logActivity(userId, "Edited", chart.id, chart.title);
    }

    return res.json(chart);
  } catch (err) {
    console.error("Update chart error:", err);
    return res.status(500).json({ error: "Failed to update chart." });
  }
});

// ── POST /api/charts/:id/star ─────────────────────────────────
// Dedicated star toggle so the frontend can call it cleanly
// and get a focused activity log entry.
router.post("/:id/star", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE saved_charts
         SET starred    = NOT starred,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, starred`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Chart not found or not yours." });
    }

    const { title, starred } = rows[0];
    await logActivity(userId, starred ? "Starred" : "Unstarred", id, title);

    return res.json({ id, starred });
  } catch (err) {
    console.error("Star toggle error:", err);
    return res.status(500).json({ error: "Failed to toggle star." });
  }
});

// ── POST /api/charts/:id/share ────────────────────────────────
// Mark chart as shared (sets chart_config.shared = true)
router.post("/:id/share", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE saved_charts
         SET chart_config = chart_config || '{"shared": true}',
             updated_at   = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, chart_config`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Chart not found or not yours." });
    }

    await logActivity(userId, "Shared", id, rows[0].title);

    return res.json({ id, shared: true });
  } catch (err) {
    console.error("Share chart error:", err);
    return res.status(500).json({ error: "Failed to share chart." });
  }
});

// ── DELETE /api/charts/:id ────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM saved_charts
         WHERE id = $1 AND user_id = $2
         RETURNING id, title`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Chart not found or not yours." });
    }

    // Log with null chart_id because row is gone; title snapshot preserved
    await logActivity(userId, "Deleted", null, result.rows[0].title);

    return res.json({ deleted: id });
  } catch (err) {
    console.error("Delete chart error:", err);
    return res.status(500).json({ error: "Failed to delete chart." });
  }
});

export default router;
