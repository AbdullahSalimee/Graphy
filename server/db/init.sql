-- ─────────────────────────────────────────────────────────────
-- GRAPHIX DATABASE SCHEMA
-- Run automatically by Docker on first start
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  avatar        TEXT NOT NULL DEFAULT 'U',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       TEXT NOT NULL DEFAULT 'free',    -- 'free' | 'pro' | 'enterprise'
  status     TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'cancelled' | 'expired'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Saved Charts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_charts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Untitled Chart',
  prompt       TEXT NOT NULL DEFAULT '',
  chart_config JSONB NOT NULL DEFAULT '{}',

  -- ── Display / dashboard fields ───────────────────────────
  tag          TEXT NOT NULL DEFAULT 'Line',   -- 'Line' | 'Bar' | 'Area' | 'Pie'
  category     TEXT NOT NULL DEFAULT 'General',
  description  TEXT NOT NULL DEFAULT '',
  views        INT  NOT NULL DEFAULT 0,
  trend        TEXT NOT NULL DEFAULT '0%',     -- e.g. '+18.4%' | '-2.1%'
  trend_up     BOOLEAN NOT NULL DEFAULT TRUE,  -- true = positive direction
  starred      BOOLEAN NOT NULL DEFAULT FALSE,
  sparkline    JSONB NOT NULL DEFAULT '[]',    -- number[] for mini chart preview

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Activity Log ─────────────────────────────────────────────
-- Records user actions for the dashboard activity feed
CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,   -- 'Created' | 'Edited' | 'Shared' | 'Starred' | 'Deleted'
  chart_id   UUID REFERENCES saved_charts(id) ON DELETE SET NULL,
  chart_title TEXT NOT NULL DEFAULT '',   -- snapshot title in case chart is deleted
  avatar     TEXT NOT NULL DEFAULT 'U',  -- user initials snapshot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Graph Templates (global, shared across all users) ────────
CREATE TABLE IF NOT EXISTS graph_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  template    JSONB NOT NULL DEFAULT '{}',
  trend       TEXT NOT NULL DEFAULT '',
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  tag         TEXT NOT NULL DEFAULT 'General',  -- chip label shown in UI
  chart_count INT  NOT NULL DEFAULT 0,          -- number of pre-built charts
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Feedbacks (global, visible to all users) ─────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  message     TEXT NOT NULL,
  rating      INT  NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id  ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_charts_user_id   ON saved_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_charts_updated   ON saved_charts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created   ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at   ON feedbacks(created_at DESC);

-- ── Seed: Global Templates ────────────────────────────────────
INSERT INTO graph_templates (title, category, description, trend, is_trending, tag, chart_count) VALUES
  ('Monthly Revenue',     'Business',  'Track revenue trends over months',          '+12.4%', TRUE,  'Finance',   6),
  ('User Growth',         'Analytics', 'Visualize user acquisition over time',      '+8.1%',  TRUE,  'Growth',    5),
  ('Sales by Region',     'Business',  'Compare sales across different regions',    '+5.3%',  FALSE, 'Business',  4),
  ('Website Traffic',     'Analytics', 'Monitor page visits and sessions',          '+22.7%', TRUE,  'Marketing', 7),
  ('Product Comparison',  'Marketing', 'Side-by-side product metrics',              '-1.2%',  FALSE, 'Product',   5),
  ('Expense Breakdown',   'Finance',   'Pie chart of spending categories',          '+0.8%',  FALSE, 'Finance',   4)
ON CONFLICT DO NOTHING;

-- ── Seed: Global Feedbacks ────────────────────────────────────
INSERT INTO feedbacks (author_name, message, rating) VALUES
  ('Alex Kim',       'Graphix turned our CSV data into beautiful dashboards instantly. Game changer!', 5),
  ('Sarah Chen',     'The AI understands exactly what chart I need. Incredibly intuitive.',            5),
  ('Marcus Johnson', 'Saved hours of work every week. The templates are spot-on.',                    4),
  ('Priya Patel',    'Best data viz tool I have used. Our presentations look so professional now.',   5)
ON CONFLICT DO NOTHING;