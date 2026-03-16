import { Router } from "express";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────

/**
 * Convert an updatedAt date to a human-readable "X ago" string.
 * Runs server-side so the client always gets a consistent value.
 */
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Compute the 4 dashboard stat cards purely from DB data.
 * No magic numbers — everything derived from real rows.
 */
function buildDashboardStats(charts, subscription) {
  const totalGraphs = charts.length;
  const totalViews = charts.reduce((sum, c) => sum + (c.views || 0), 0);
  const sharedCount = charts.filter(
    (c) => c.chart_config?.shared === true,
  ).length;

  // Storage: rough estimate — each chart_config JSON byte ≈ 1 byte
  const storageBytes = charts.reduce(
    (sum, c) => sum + JSON.stringify(c.chart_config || {}).length,
    0,
  );
  const storageMB = (storageBytes / (1024 * 1024)).toFixed(1);

  // Deltas — compare last 7 days vs previous 7 days
  const now = Date.now();
  const day7 = now - 7 * 86400_000;
  const day14 = now - 14 * 86400_000;

  const recentCharts = charts.filter(
    (c) => new Date(c.created_at).getTime() > day7,
  ).length;
  const prevCharts = charts.filter(
    (c) =>
      new Date(c.created_at).getTime() > day14 &&
      new Date(c.created_at).getTime() <= day7,
  ).length;
  const chartsDelta = recentCharts - prevCharts;

  const recentViews = charts
    .filter((c) => new Date(c.updated_at).getTime() > day7)
    .reduce((s, c) => s + (c.views || 0), 0);

  return [
    {
      label: "Total Graphs",
      value: String(totalGraphs),
      delta:
        chartsDelta > 0
          ? `+${chartsDelta} this week`
          : chartsDelta < 0
            ? `${chartsDelta} this week`
            : "No change",
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
    {
      label: "Total Views",
      value:
        totalViews >= 1000
          ? `${(totalViews / 1000).toFixed(1)}k`
          : String(totalViews),
      delta: recentViews > 0 ? `+${recentViews} this week` : "No views yet",
      icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    },
    {
      label: "Shared Links",
      value: String(sharedCount),
      delta: sharedCount > 0 ? `${sharedCount} active` : "None shared",
      icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
    },
    {
      label: "Storage Used",
      value: `${storageMB}MB`,
      delta:
        subscription?.plan === "free"
          ? "Free plan limit: 100MB"
          : "Unlimited on Pro",
      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    },
  ];
}

// ── GET /api/user/bootstrap ───────────────────────────────────
router.get("/bootstrap", requireAuth, async (req, res) => {
  const { userId } = req.user;

  try {
    const [
      userResult,
      subResult,
      chartsResult,
      activityResult,
      templatesResult,
      feedbacksResult,
    ] = await Promise.all([
      // User profile
      pool.query(
        `SELECT id, email, first_name, last_name, avatar, created_at
           FROM users WHERE id = $1`,
        [userId],
      ),

      // Latest subscription
      pool.query(
        `SELECT plan, status, started_at, expires_at
           FROM subscriptions WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 1`,
        [userId],
      ),

      // Saved charts — all new display columns included
      pool.query(
        `SELECT
           id, title, prompt, chart_config,
           tag, category, description,
           views, trend, trend_up, starred, sparkline,
           created_at, updated_at
         FROM saved_charts
         WHERE user_id = $1
         ORDER BY updated_at DESC
         LIMIT 50`,
        [userId],
      ),

      // Activity feed — last 20 actions by this user
      pool.query(
        `SELECT
           al.id, al.action, al.chart_title, al.avatar, al.created_at,
           al.user_id = $1 AS own
         FROM activity_log al
         WHERE al.user_id = $1
         ORDER BY al.created_at DESC
         LIMIT 20`,
        [userId],
      ),

      // Global templates
      pool.query(
        `SELECT id, title, category, description,
                trend, is_trending, template,
                tag, chart_count
           FROM graph_templates
           ORDER BY is_trending DESC, created_at ASC`,
      ),

      // Global feedbacks
      pool.query(
        `SELECT id, author_name, message, rating, created_at
           FROM feedbacks
           ORDER BY created_at DESC LIMIT 20`,
      ),
    ]);

    // ── 404 guard ─────────────────────────────────────────────
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

    const charts = chartsResult.rows;

    // ── Shape savedCharts ─────────────────────────────────────
    const savedCharts = charts.map((c) => ({
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
    }));

    // ── Shape activityFeed ────────────────────────────────────
    const activityFeed = activityResult.rows.map((a) => ({
      id: a.id,
      action: a.action,
      graph: a.chart_title,
      time: timeAgo(a.created_at),
      avatar: a.avatar,
      own: a.own,
    }));

    // ── Compute dashboardStats from real data ─────────────────
    const dashboardStats = buildDashboardStats(charts, sub);

    // ── Shape globalData ──────────────────────────────────────
    const graphTemplates = templatesResult.rows.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      description: t.description,
      trend: t.trend,
      isTrending: t.is_trending,
      template: t.template,
      tag: t.tag,
      count: t.chart_count,
      desc: t.description,
    }));

    const feedbacks = feedbacksResult.rows.map((f) => ({
      id: f.id,
      authorName: f.author_name,
      message: f.message,
      rating: f.rating,
      createdAt: f.created_at,
    }));

    // ── Final response ────────────────────────────────────────
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
      savedCharts,
      dashboardStats,
      activityFeed,
      globalData: {
        graphTemplates,
        feedbacks,
      },
    });
  } catch (err) {
    console.error("Bootstrap error:", err);
    return res.status(500).json({ error: "Failed to load user data." });
  }
});

export default router;