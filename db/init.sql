-- ─────────────────────────────────────────────────────────────
-- GRAPHIX DATABASE SCHEMA
-- Run automatically by Docker on first start
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  avatar       TEXT NOT NULL DEFAULT 'U',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'enterprise'
  status      TEXT NOT NULL DEFAULT 'active', -- 'active' | 'cancelled' | 'expired'
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Saved Charts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_charts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Untitled Chart',
  prompt       TEXT NOT NULL DEFAULT '',
  chart_config JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Feedbacks (global, visible to all users) ─────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  message     TEXT NOT NULL,
  rating      INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_charts_user_id  ON saved_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at  ON feedbacks(created_at DESC);

-- ── Seed: Global Templates ────────────────────────────────────
INSERT INTO graph_templates (title, category, description, trend, is_trending) VALUES
  ('Monthly Revenue', 'Business', 'Track revenue trends over months', '+12.4%', TRUE),
  ('User Growth', 'Analytics', 'Visualize user acquisition over time', '+8.1%', TRUE),
  ('Sales by Region', 'Business', 'Compare sales across different regions', '+5.3%', FALSE),
  ('Website Traffic', 'Analytics', 'Monitor page visits and sessions', '+22.7%', TRUE),
  ('Product Comparison', 'Marketing', 'Side-by-side product metrics', '-1.2%', FALSE),
  ('Expense Breakdown', 'Finance', 'Pie chart of spending categories', '+0.8%', FALSE)
ON CONFLICT DO NOTHING;

-- ── Seed: Global Feedbacks ────────────────────────────────────
INSERT INTO feedbacks (author_name, message, rating) VALUES
  ('Alex Kim', 'Graphix turned our CSV data into beautiful dashboards instantly. Game changer!', 5),
  ('Sarah Chen', 'The AI understands exactly what chart I need. Incredibly intuitive.', 5),
  ('Marcus Johnson', 'Saved hours of work every week. The templates are spot-on.', 4),
  ('Priya Patel', 'Best data viz tool I have used. Our presentations look so professional now.', 5)
ON CONFLICT DO NOTHING;
