-- ============================================================
-- Migration: recently_viewed table + junction table RLS
-- Date: 2026-04-22
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1: recently_viewed table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recently_viewed (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id    UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id
  ON recently_viewed (user_id, last_viewed_at DESC);

ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own recently_viewed" ON recently_viewed;
CREATE POLICY "Users manage own recently_viewed"
  ON recently_viewed FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- SECTION 2: RLS on review_payment_tactics
-- ────────────────────────────────────────────────────────────

ALTER TABLE review_payment_tactics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors can manage their own review tactics" ON review_payment_tactics;
CREATE POLICY "Contractors can manage their own review tactics"
  ON review_payment_tactics FOR ALL
  TO authenticated
  USING (
    review_id IN (
      SELECT id FROM reviews WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    review_id IN (
      SELECT id FROM reviews WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read submitted review tactics" ON review_payment_tactics;
CREATE POLICY "Authenticated users can read submitted review tactics"
  ON review_payment_tactics FOR SELECT
  TO authenticated
  USING (
    review_id IN (
      SELECT id FROM reviews WHERE status = 'submitted'
    )
  );

-- ────────────────────────────────────────────────────────────
-- SECTION 3: RLS on review_red_flags
-- ────────────────────────────────────────────────────────────

ALTER TABLE review_red_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors can manage their own review red flags" ON review_red_flags;
CREATE POLICY "Contractors can manage their own review red flags"
  ON review_red_flags FOR ALL
  TO authenticated
  USING (
    review_id IN (
      SELECT id FROM reviews WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    review_id IN (
      SELECT id FROM reviews WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read submitted review red flags" ON review_red_flags;
CREATE POLICY "Authenticated users can read submitted review red flags"
  ON review_red_flags FOR SELECT
  TO authenticated
  USING (
    review_id IN (
      SELECT id FROM reviews WHERE status = 'submitted'
    )
  );
