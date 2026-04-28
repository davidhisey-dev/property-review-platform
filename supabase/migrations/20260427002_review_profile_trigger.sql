-- Trigger: automatically rebuild property_profiles whenever a review
-- is inserted, updated, or deleted in a way that affects submitted counts.

CREATE OR REPLACE FUNCTION trigger_rebuild_property_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Fire on INSERT with status = 'submitted'
  IF TG_OP = 'INSERT' AND NEW.status = 'submitted' THEN
    PERFORM rebuild_property_profile(NEW.property_id);
  END IF;

  -- Fire on UPDATE when status changes TO 'submitted'
  -- or FROM 'submitted' (covers discard of submitted review)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'submitted' AND OLD.status != 'submitted' THEN
      PERFORM rebuild_property_profile(NEW.property_id);
    END IF;
    IF OLD.status = 'submitted' AND NEW.status != 'submitted' THEN
      PERFORM rebuild_property_profile(OLD.property_id);
    END IF;
  END IF;

  -- Fire on DELETE if the deleted review was submitted
  IF TG_OP = 'DELETE' AND OLD.status = 'submitted' THEN
    PERFORM rebuild_property_profile(OLD.property_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rebuild_profile_on_review_change ON reviews;

CREATE TRIGGER rebuild_profile_on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_rebuild_property_profile();
