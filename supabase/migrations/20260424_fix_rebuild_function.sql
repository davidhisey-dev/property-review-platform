-- Fix rebuild_property_profile(): updated_at → last_calculated_at
-- The property_profiles table uses last_calculated_at, not updated_at.

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
    last_calculated_at
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
    review_count                    = EXCLUDED.review_count,
    avg_overall_rating              = EXCLUDED.avg_overall_rating,
    avg_payment_timeliness          = EXCLUDED.avg_payment_timeliness,
    avg_ease_of_collecting          = EXCLUDED.avg_ease_of_collecting,
    avg_final_payment_experience    = EXCLUDED.avg_final_payment_experience,
    avg_scope_clarity               = EXCLUDED.avg_scope_clarity,
    avg_scope_change_frequency      = EXCLUDED.avg_scope_change_frequency,
    avg_change_order_willingness    = EXCLUDED.avg_change_order_willingness,
    avg_ease_of_interaction         = EXCLUDED.avg_ease_of_interaction,
    avg_responsiveness              = EXCLUDED.avg_responsiveness,
    avg_professionalism             = EXCLUDED.avg_professionalism,
    avg_decision_consistency        = EXCLUDED.avg_decision_consistency,
    avg_timeline_expectations       = EXCLUDED.avg_timeline_expectations,
    avg_plan_readiness              = EXCLUDED.avg_plan_readiness,
    avg_financial_readiness         = EXCLUDED.avg_financial_readiness,
    avg_site_accessibility          = EXCLUDED.avg_site_accessibility,
    no_call_no_show_count           = EXCLUDED.no_call_no_show_count,
    flag_payment_delays_count       = EXCLUDED.flag_payment_delays_count,
    flag_legal_action_count         = EXCLUDED.flag_legal_action_count,
    flag_disputed_scope_count       = EXCLUDED.flag_disputed_scope_count,
    flag_aggressive_behaviour_count = EXCLUDED.flag_aggressive_behaviour_count,
    flag_safety_challenges_count    = EXCLUDED.flag_safety_challenges_count,
    last_calculated_at              = now();
END;
$$ LANGUAGE plpgsql;

-- Rebuild profiles for all properties that have submitted reviews
SELECT rebuild_property_profile(property_id)
FROM (
  SELECT DISTINCT property_id
  FROM reviews
  WHERE status = 'submitted'
) p;
