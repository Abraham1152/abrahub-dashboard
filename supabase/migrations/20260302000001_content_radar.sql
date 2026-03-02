-- ============================================================
-- Content Radar Agent — Database Schema
-- Radar + Roteirista + Editor de Ângulos
-- ============================================================

-- 1. Competitor profiles to monitor
CREATE TABLE IF NOT EXISTS content_radar_competitors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'instagram',
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  follower_count INTEGER,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_radar_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read/write content_radar_competitors"
  ON content_radar_competitors FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 2. Raw posts captured from competitor profiles
CREATE TABLE IF NOT EXISTS content_radar_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   uuid REFERENCES content_radar_competitors(id) ON DELETE CASCADE,
  post_id         TEXT UNIQUE NOT NULL,   -- Instagram media ID
  media_type      TEXT,                   -- IMAGE, VIDEO, REEL, CAROUSEL
  caption         TEXT,
  hashtags        TEXT[] DEFAULT '{}',
  like_count      INTEGER NOT NULL DEFAULT 0,
  comment_count   INTEGER NOT NULL DEFAULT 0,
  view_count      INTEGER,
  permalink       TEXT,
  posted_at       TIMESTAMPTZ,
  viral_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_radar_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read/write content_radar_posts"
  ON content_radar_posts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_content_radar_posts_competitor ON content_radar_posts(competitor_id);
CREATE INDEX IF NOT EXISTS idx_content_radar_posts_viral ON content_radar_posts(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_radar_posts_posted ON content_radar_posts(posted_at DESC);

-- 3. AI analysis results per post
CREATE TABLE IF NOT EXISTS content_radar_analysis (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             uuid UNIQUE REFERENCES content_radar_posts(id) ON DELETE CASCADE,
  format              TEXT,   -- talking_head, screen_record, meme, pov, mini_doc, carousel, before_after, other
  hook_type           TEXT,   -- promise, shock, curiosity, common_mistake, nobody_tells_you, comparison, transformation, other
  hook_phrase         TEXT,
  retention_mechanism TEXT,   -- quick_cuts, list, tension, expectation_break, visual_proof, challenge, other
  proof_type          TEXT,   -- demo, numbers, testimonial, screen_proof, none
  engagement_bait     TEXT,   -- question, poll, challenge, none
  why_viral           TEXT,
  raw_analysis        JSONB,
  analyzed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_radar_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read/write content_radar_analysis"
  ON content_radar_analysis FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 4. Weekly viral pattern maps
CREATE TABLE IF NOT EXISTS content_radar_patterns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start          DATE NOT NULL UNIQUE,
  top_hooks           JSONB DEFAULT '{}',       -- { "promise": 5, "curiosity": 3 }
  top_formats         JSONB DEFAULT '{}',
  trending_themes     TEXT[] DEFAULT '{}',
  gaps                TEXT[] DEFAULT '{}',       -- "o que ninguém explicou bem"
  saturated_themes    TEXT[] DEFAULT '{}',
  summary             TEXT,
  posts_analyzed      INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_radar_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read/write content_radar_patterns"
  ON content_radar_patterns FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 5. Generated content ideas — the Idea Bank
CREATE TABLE IF NOT EXISTS content_radar_ideas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_post_id  uuid REFERENCES content_radar_posts(id) ON DELETE SET NULL,
  pattern_id      uuid REFERENCES content_radar_patterns(id) ON DELETE SET NULL,
  format          TEXT,
  hook_text       TEXT NOT NULL,
  script_hook     TEXT,         -- first 3-5 seconds of content
  script_beats    TEXT[] DEFAULT '{}',  -- main content beats
  script_payoff   TEXT,
  script_cta      TEXT,
  cover_suggestion TEXT,
  caption         TEXT,
  hashtags        TEXT[] DEFAULT '{}',
  takes_needed    TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'new',  -- new | saved | used | discarded
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_radar_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read/write content_radar_ideas"
  ON content_radar_ideas FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_content_radar_ideas_status ON content_radar_ideas(status);
CREATE INDEX IF NOT EXISTS idx_content_radar_ideas_created ON content_radar_ideas(created_at DESC);

-- 6. Per-user / global agent configuration
CREATE TABLE IF NOT EXISTS content_radar_config (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  themes                   TEXT[] NOT NULL DEFAULT '{}',
  restrictions             TEXT NOT NULL DEFAULT '',
  target_duration_seconds  INTEGER NOT NULL DEFAULT 30,
  cta_preference           TEXT NOT NULL DEFAULT 'Salva isso porque...',
  rapidapi_key             TEXT NOT NULL DEFAULT '',
  collect_days             INTEGER NOT NULL DEFAULT 7,
  ideas_per_run            INTEGER NOT NULL DEFAULT 15,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  last_run_at              TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a default config row
INSERT INTO content_radar_config (id) VALUES (gen_random_uuid())
  ON CONFLICT DO NOTHING;

ALTER TABLE content_radar_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read/write content_radar_config"
  ON content_radar_config FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
