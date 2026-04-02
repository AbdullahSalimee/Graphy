import { Router } from "express";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── POST /api/feedback ────────────────────────────────────────
// Public route — no auth required so landing-page visitors can submit.
// If a valid JWT is present we attach the user_id for traceability.
router.post("/", requireAuth, async (req, res) => {
  const { name, email, thoughts, rating = 5 } = req.body;

  const { userId } = req.user;

  console.log("Server received feedback:", {
    name,
    email,
    thoughts,
    rating,
    userId,
  });
  // ── Validation ────────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res
      .status(400)
      .json({ error: "Name must be at least 2 characters." });
  }
  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  if (
    !thoughts ||
    typeof thoughts !== "string" ||
    thoughts.trim().length < 10
  ) {
    return res
      .status(400)
      .json({ error: "Thoughts must be at least 10 characters." });
  }
  if (thoughts.trim().length > 1000) {
    return res
      .status(400)
      .json({ error: "Thoughts must be 1000 characters or fewer." });
  }
  const safeRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));

  try {
    const { rows } = await pool.query(
      `INSERT INTO feedbacks (user_id, author_name, message, rating)
       VALUES ($1, $2, $3, $4)
       RETURNING id, author_name, message, rating, created_at`,
      [userId, name.trim(), thoughts.trim(), safeRating],
    );

    const fb = rows[0];
    return res.status(201).json({
      id: fb.id,
      authorName: fb.author_name,
      message: fb.message,
      rating: fb.rating,
      createdAt: fb.created_at,
    });
  } catch (err) {
    console.error("Feedback insert error:", err);
    return res
      .status(500)
      .json({ error: "Failed to save feedback. Please try again." });
  }
});

// ── GET /api/feedback ─────────────────────────────────────────
// Returns the latest 20 feedbacks — used by the landing page ticker
// and the dashboard bootstrap (mirroring what user.js already queries).
// Public so unauthenticated visitors can see testimonials.
router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, author_name, message, rating, created_at
         FROM feedbacks
         ORDER BY created_at DESC
         LIMIT 20`,
    );

    return res.json(
      rows.map((f) => ({
        id: f.id,
        authorName: f.author_name,
        message: f.message,
        rating: f.rating,
        createdAt: f.created_at,
      })),
    );
  } catch (err) {
    console.error("Feedback fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch feedbacks." });
  }
});

// ── GET /api/feedback/mine ────────────────────────────────────
// Auth-gated — returns only the current user's submitted feedbacks.
router.get("/mine", requireAuth, async (req, res) => {
  const { userId } = req.user;

  try {
    const { rows } = await pool.query(
      `SELECT id, author_name, message, rating, created_at
         FROM feedbacks
         WHERE user_id = $1
         ORDER BY created_at DESC`,
      [userId],
    );

    return res.json(
      rows.map((f) => ({
        id: f.id,
        authorName: f.author_name,
        message: f.message,
        rating: f.rating,
        createdAt: f.created_at,
      })),
    );
  } catch (err) {
    console.error("Feedback/mine error:", err);
    return res.status(500).json({ error: "Failed to fetch your feedbacks." });
  }
});

export default router;
