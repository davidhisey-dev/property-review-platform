-- ============================================================
-- Migration: Review Form Expansion + Draft System
-- Date: 2026-04-20
-- Safe to re-run: all ADD COLUMNs are guarded with IF NOT EXISTS
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1a: Status & Draft System Columns
--
-- NOTE: `status` already exists on reviews. The existing code
-- inserts status='published' which is NOT in the new allowed
-- set ('draft','submitted','discarded'). A new CHECK constraint
-- is NOT added here to avoid breaking existing data/inserts.
-- ACTION REQUIRED after migration: decide whether to migrate
-- existing 'published' rows to 'submitted' and update the
-- review/page.tsx insert to use 'submitted' instead.
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='last_edited_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN last_edited_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='discarded_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN discarded_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='stale_prompt_sent_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN stale_prompt_sent_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='snooze_until'
  ) THEN
    ALTER TABLE reviews ADD COLUMN snooze_until TIMESTAMPTZ;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1b: Project Info
-- SKIPPED (already exist): no_call_no_show, job_description
-- NOTE: job_completion_date (DATE) is a new column distinct
-- from the existing job_completed_at (TIMESTAMPTZ).
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='primary_contact_name'
  ) THEN
    ALTER TABLE reviews ADD COLUMN primary_contact_name TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='primary_contact_is_owner'
  ) THEN
    ALTER TABLE reviews ADD COLUMN primary_contact_is_owner TEXT
      CHECK (primary_contact_is_owner IN ('yes', 'no', 'unknown'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='contractor_role'
  ) THEN
    ALTER TABLE reviews ADD COLUMN contractor_role TEXT
      CHECK (contractor_role IN ('general_contractor', 'subcontractor', 'specialist_trade'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='job_completion_date'
  ) THEN
    ALTER TABLE reviews ADD COLUMN job_completion_date DATE;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1c: Overall Experience
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='would_work_again'
  ) THEN
    ALTER TABLE reviews ADD COLUMN would_work_again TEXT
      CHECK (would_work_again IN ('yes', 'no', 'higher_price_stricter_terms'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1d: Payment & Financial Behaviour
-- SKIPPED (already exists): payment_timeliness
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='ease_of_collecting_payment'
  ) THEN
    ALTER TABLE reviews ADD COLUMN ease_of_collecting_payment SMALLINT
      CHECK (ease_of_collecting_payment BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='final_payment_experience'
  ) THEN
    ALTER TABLE reviews ADD COLUMN final_payment_experience SMALLINT
      CHECK (final_payment_experience BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_payment_delays'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_payment_delays BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_renegotiated_mid_project'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_renegotiated_mid_project BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_required_legal_action'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_required_legal_action BOOLEAN;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1e: Scope & Change Behaviour
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='scope_clarity'
  ) THEN
    ALTER TABLE reviews ADD COLUMN scope_clarity SMALLINT
      CHECK (scope_clarity BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='scope_change_frequency'
  ) THEN
    ALTER TABLE reviews ADD COLUMN scope_change_frequency SMALLINT
      CHECK (scope_change_frequency BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='change_order_willingness'
  ) THEN
    ALTER TABLE reviews ADD COLUMN change_order_willingness SMALLINT
      CHECK (change_order_willingness BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='change_request_count'
  ) THEN
    ALTER TABLE reviews ADD COLUMN change_request_count SMALLINT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_expected_unpaid_work'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_expected_unpaid_work BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_disputed_agreed_scope'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_disputed_agreed_scope BOOLEAN;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1f: Communication & Decision-Making
-- SKIPPED (already exists): ease_of_interaction
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='responsiveness'
  ) THEN
    ALTER TABLE reviews ADD COLUMN responsiveness SMALLINT
      CHECK (responsiveness BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='professionalism'
  ) THEN
    ALTER TABLE reviews ADD COLUMN professionalism SMALLINT
      CHECK (professionalism BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='clear_decision_maker'
  ) THEN
    ALTER TABLE reviews ADD COLUMN clear_decision_maker BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='decision_consistency'
  ) THEN
    ALTER TABLE reviews ADD COLUMN decision_consistency SMALLINT
      CHECK (decision_consistency BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_hard_to_reach'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_hard_to_reach BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_conflicting_directions'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_conflicting_directions BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_frequent_reversals'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_frequent_reversals BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_last_minute_changes'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_last_minute_changes BOOLEAN;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1g: Timeline, Preparedness & Site Conditions
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='timeline_expectations'
  ) THEN
    ALTER TABLE reviews ADD COLUMN timeline_expectations SMALLINT
      CHECK (timeline_expectations BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='plan_design_readiness'
  ) THEN
    ALTER TABLE reviews ADD COLUMN plan_design_readiness SMALLINT
      CHECK (plan_design_readiness BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='financial_readiness'
  ) THEN
    ALTER TABLE reviews ADD COLUMN financial_readiness SMALLINT
      CHECK (financial_readiness BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='site_type'
  ) THEN
    ALTER TABLE reviews ADD COLUMN site_type TEXT
      CHECK (site_type IN ('occupied', 'vacant'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='site_accessibility'
  ) THEN
    ALTER TABLE reviews ADD COLUMN site_accessibility SMALLINT
      CHECK (site_accessibility BETWEEN 1 AND 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_unrealistic_deadlines'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_unrealistic_deadlines BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_blamed_for_delays'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_blamed_for_delays BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_major_changes_after_start'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_major_changes_after_start BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_financial_issues_impacted'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_financial_issues_impacted BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_site_restrictions_impacted'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_site_restrictions_impacted BOOLEAN;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='flag_safety_or_access_challenges'
  ) THEN
    ALTER TABLE reviews ADD COLUMN flag_safety_or_access_challenges BOOLEAN;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1h: Your Review (short text fields)
-- title and body already exist — skipped
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='watch_out_for'
  ) THEN
    ALTER TABLE reviews ADD COLUMN watch_out_for TEXT
      CHECK (char_length(watch_out_for) <= 150);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reviews' AND column_name='what_worked_well'
  ) THEN
    ALTER TABLE reviews ADD COLUMN what_worked_well TEXT
      CHECK (char_length(what_worked_well) <= 150);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 1i: Indexes on reviews
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_status
  ON reviews (status);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id_status
  ON reviews (user_id, status);

CREATE INDEX IF NOT EXISTS idx_reviews_last_edited_at
  ON reviews (last_edited_at);

CREATE INDEX IF NOT EXISTS idx_reviews_property_id_status
  ON reviews (property_id, status);

-- ────────────────────────────────────────────────────────────
-- SECTION 2: client_pattern_tags reference table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_pattern_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT        NOT NULL UNIQUE,
  slug       TEXT        NOT NULL UNIQUE,
  sort_order SMALLINT    NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO client_pattern_tags (label, slug, sort_order) VALUES
  ('Easy / Professional',       'easy_professional',       1),
  ('Organized',                 'organized',               2),
  ('Indecisive',                'indecisive',              3),
  ('Price-sensitive',           'price_sensitive',         4),
  ('Scope creeper',             'scope_creeper',           5),
  ('High expectations',         'high_expectations',       6),
  ('Difficult / high conflict', 'difficult_high_conflict', 7),
  ('High risk',                 'high_risk',               8)
ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 3: review_client_pattern_tags junction table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_client_pattern_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  UUID        NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  tag_id     UUID        NOT NULL REFERENCES client_pattern_tags (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_review_client_pattern_tags_review_id
  ON review_client_pattern_tags (review_id);

CREATE INDEX IF NOT EXISTS idx_review_client_pattern_tags_tag_id
  ON review_client_pattern_tags (tag_id);

-- ────────────────────────────────────────────────────────────
-- SECTION 4: property_profiles new aggregate columns
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_payment_timeliness') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_payment_timeliness NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_ease_of_collecting') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_ease_of_collecting NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_final_payment_experience') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_final_payment_experience NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_scope_clarity') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_scope_clarity NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_scope_change_frequency') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_scope_change_frequency NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_change_order_willingness') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_change_order_willingness NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_ease_of_interaction') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_ease_of_interaction NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_responsiveness') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_responsiveness NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_professionalism') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_professionalism NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_decision_consistency') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_decision_consistency NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_timeline_expectations') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_timeline_expectations NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_plan_readiness') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_plan_readiness NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_financial_readiness') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_financial_readiness NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='avg_site_accessibility') THEN
    ALTER TABLE property_profiles ADD COLUMN avg_site_accessibility NUMERIC(3,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='no_call_no_show_count') THEN
    ALTER TABLE property_profiles ADD COLUMN no_call_no_show_count SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='flag_payment_delays_count') THEN
    ALTER TABLE property_profiles ADD COLUMN flag_payment_delays_count SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='flag_legal_action_count') THEN
    ALTER TABLE property_profiles ADD COLUMN flag_legal_action_count SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='flag_disputed_scope_count') THEN
    ALTER TABLE property_profiles ADD COLUMN flag_disputed_scope_count SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='flag_aggressive_behaviour_count') THEN
    ALTER TABLE property_profiles ADD COLUMN flag_aggressive_behaviour_count SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_profiles' AND column_name='flag_safety_challenges_count') THEN
    ALTER TABLE property_profiles ADD COLUMN flag_safety_challenges_count SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- SECTION 4b: rebuild_property_profile function (replace)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rebuild_property_profile(p_property_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO property_profiles (
    property_id,
    review_count,
    avg_overall_rating,
    avg_payment_timeliness,
    avg_ease_of_collecting,
    avg_final_payment_experience,
    avg_scope_clarity,
    avg_scope_change_frequency,
    avg_change_order_willingness,
    avg_ease_of_interaction,
    avg_responsiveness,
    avg_professionalism,
    avg_decision_consistency,
    avg_timeline_expectations,
    avg_plan_readiness,
    avg_financial_readiness,
    avg_site_accessibility,
    no_call_no_show_count,
    flag_payment_delays_count,
    flag_legal_action_count,
    flag_disputed_scope_count,
    flag_aggressive_behaviour_count,
    flag_safety_challenges_count,
    updated_at
  )
  SELECT
    p_property_id,
    COUNT(*),
    ROUND(AVG(overall_rating)::NUMERIC, 2),
    ROUND(AVG(payment_timeliness)::NUMERIC, 2),
    ROUND(AVG(ease_of_collecting_payment)::NUMERIC, 2),
    ROUND(AVG(final_payment_experience)::NUMERIC, 2),
    ROUND(AVG(scope_clarity)::NUMERIC, 2),
    ROUND(AVG(scope_change_frequency)::NUMERIC, 2),
    ROUND(AVG(change_order_willingness)::NUMERIC, 2),
    ROUND(AVG(ease_of_interaction)::NUMERIC, 2),
    ROUND(AVG(responsiveness)::NUMERIC, 2),
    ROUND(AVG(professionalism)::NUMERIC, 2),
    ROUND(AVG(decision_consistency)::NUMERIC, 2),
    ROUND(AVG(timeline_expectations)::NUMERIC, 2),
    ROUND(AVG(plan_design_readiness)::NUMERIC, 2),
    ROUND(AVG(financial_readiness)::NUMERIC, 2),
    ROUND(AVG(site_accessibility)::NUMERIC, 2),
    COUNT(*) FILTER (WHERE no_call_no_show = true),
    COUNT(*) FILTER (WHERE flag_payment_delays = true),
    COUNT(*) FILTER (WHERE flag_required_legal_action = true),
    COUNT(*) FILTER (WHERE flag_disputed_agreed_scope = true),
    COUNT(*) FILTER (WHERE flag_conflicting_directions = true
                       OR flag_frequent_reversals = true),
    COUNT(*) FILTER (WHERE flag_safety_or_access_challenges = true),
    now()
  FROM reviews
  WHERE property_id = p_property_id
    AND status = 'submitted'
  ON CONFLICT (property_id) DO UPDATE SET
    review_count                  = EXCLUDED.review_count,
    avg_overall_rating            = EXCLUDED.avg_overall_rating,
    avg_payment_timeliness        = EXCLUDED.avg_payment_timeliness,
    avg_ease_of_collecting        = EXCLUDED.avg_ease_of_collecting,
    avg_final_payment_experience  = EXCLUDED.avg_final_payment_experience,
    avg_scope_clarity             = EXCLUDED.avg_scope_clarity,
    avg_scope_change_frequency    = EXCLUDED.avg_scope_change_frequency,
    avg_change_order_willingness  = EXCLUDED.avg_change_order_willingness,
    avg_ease_of_interaction       = EXCLUDED.avg_ease_of_interaction,
    avg_responsiveness            = EXCLUDED.avg_responsiveness,
    avg_professionalism           = EXCLUDED.avg_professionalism,
    avg_decision_consistency      = EXCLUDED.avg_decision_consistency,
    avg_timeline_expectations     = EXCLUDED.avg_timeline_expectations,
    avg_plan_readiness            = EXCLUDED.avg_plan_readiness,
    avg_financial_readiness       = EXCLUDED.avg_financial_readiness,
    avg_site_accessibility        = EXCLUDED.avg_site_accessibility,
    no_call_no_show_count         = EXCLUDED.no_call_no_show_count,
    flag_payment_delays_count     = EXCLUDED.flag_payment_delays_count,
    flag_legal_action_count       = EXCLUDED.flag_legal_action_count,
    flag_disputed_scope_count     = EXCLUDED.flag_disputed_scope_count,
    flag_aggressive_behaviour_count = EXCLUDED.flag_aggressive_behaviour_count,
    flag_safety_challenges_count  = EXCLUDED.flag_safety_challenges_count,
    updated_at                    = now();
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- SECTION 6: Row Level Security
-- ────────────────────────────────────────────────────────────

-- client_pattern_tags: readable by all authenticated users
ALTER TABLE client_pattern_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read client pattern tags"
  ON client_pattern_tags;

CREATE POLICY "Authenticated users can read client pattern tags"
  ON client_pattern_tags FOR SELECT
  TO authenticated
  USING (true);

-- review_client_pattern_tags: contractors manage their own
ALTER TABLE review_client_pattern_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors can manage their own review tags"
  ON review_client_pattern_tags;

CREATE POLICY "Contractors can manage their own review tags"
  ON review_client_pattern_tags FOR ALL
  TO authenticated
  USING (
    review_id IN (
      SELECT id FROM reviews WHERE user_id = auth.uid()
    )
  );

-- reviews draft visibility policy
-- NOTE: reviews table should already have RLS enabled.
-- This adds a named policy for draft/discarded visibility.
-- If a conflicting SELECT policy already exists, the DROP IF EXISTS
-- will clear it first.
DROP POLICY IF EXISTS "Contractors can only see their own drafts"
  ON reviews;

CREATE POLICY "Contractors can only see their own drafts"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    status = 'submitted'
    OR (status IN ('draft', 'discarded') AND user_id = auth.uid())
  );
