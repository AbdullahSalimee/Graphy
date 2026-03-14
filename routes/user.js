import { Router } from "express";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── GET /api/user/bootstrap ───────────────────────────────────
router.get("/bootstrap", requireAuth, async (req, res) => {
  const { userId } = req.user;

  try {
    const [
      userResult,
      subResult,
      chartsResult,
      templatesResult,
      feedbacksResult,
    ] = await Promise.all([
      pool.query(
        "SELECT id, email, first_name, last_name, avatar, created_at FROM users WHERE id = $1",
        [userId],
      ),
      pool.query(
        `SELECT plan, status, started_at, expires_at
           FROM subscriptions WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 1`,
        [userId],
      ),
      pool.query(
        `SELECT id, title, prompt, chart_config, created_at, updated_at
           FROM saved_charts WHERE user_id = $1
           ORDER BY updated_at DESC LIMIT 50`,
        [userId],
      ),
      pool.query(
        "SELECT id, title, category, description, trend, is_trending, template FROM graph_templates ORDER BY is_trending DESC, created_at ASC",
      ),
      pool.query(
        "SELECT id, author_name, message, rating, created_at FROM feedbacks ORDER BY created_at DESC LIMIT 20",
      ),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const u = userResult.rows[0];
    const sub = subResult.rows[0] || {
      plan: "free",
      status: "active",
      started_at: null,
      expires_at: null,
    };

    return res.json({
      user: {
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        avatar: u.avatar,
        createdAt: u.created_at,
      },
      subscription: {
        plan: sub.plan,
        status: sub.status,
        startedAt: sub.started_at,
        expiresAt: sub.expires_at,
      },
      savedCharts: chartsResult.rows.map((c) => ({
        id: c.id,
        title: c.title,
        prompt: c.prompt,
        chartConfig: c.chart_config,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      globalData: {
        graphTemplates: templatesResult.rows.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          description: t.description,
          trend: t.trend,
          isTrending: t.is_trending,
          template: t.template,
        })),
        feedbacks: feedbacksResult.rows.map((f) => ({
          id: f.id,
          authorName: f.author_name,
          message: f.message,
          rating: f.rating,
          createdAt: f.created_at,
        })),
      },
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    return res.status(500).json({ error: "Failed to load user data." });
  }
});

export default router;
