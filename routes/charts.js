import { Router } from "express";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── POST /api/charts ──────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const { title, prompt, chartConfig } = req.body;
  const { userId } = req.user;

  if (!chartConfig) {
    return res.status(400).json({ error: "chartConfig is required." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO saved_charts (user_id, title, prompt, chart_config)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, prompt, chart_config, created_at, updated_at`,
      [userId, title || "Untitled Chart", prompt || "", chartConfig],
    );

    const c = rows[0];
    return res.status(201).json({
      id: c.id,
      title: c.title,
      prompt: c.prompt,
      chartConfig: c.chart_config,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    });
  } catch (err) {
    console.error("Save chart error:", err);
    return res.status(500).json({ error: "Failed to save chart." });
  }
});

// ── DELETE /api/charts/:id ────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM saved_charts WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Chart not found or not yours." });
    }

    return res.json({ deleted: id });
  } catch (err) {
    console.error("Delete chart error:", err);
    return res.status(500).json({ error: "Failed to delete chart." });
  }
});

// ── PATCH /api/charts/:id ─────────────────────────────────────
router.patch("/:id", requireAuth, async (req, res) => {
  const { userId } = req.user;
  const { id } = req.params;
  const { title } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE saved_charts SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, updated_at`,
      [title, id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Chart not found or not yours." });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Update chart error:", err);
    return res.status(500).json({ error: "Failed to update chart." });
  }
});

export default router;
