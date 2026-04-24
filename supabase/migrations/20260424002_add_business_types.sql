-- Add new business types if not already present
INSERT INTO business_types (code, label, is_active)
SELECT t.code, t.label, true
FROM (VALUES
  ('mobile_detailing', 'Mobile Detailing'),
  ('house_cleaning',   'House Cleaning'),
  ('power_washing',    'Power Washing'),
  ('window_washing',   'Window Washing')
) AS t(code, label)
WHERE NOT EXISTS (
  SELECT 1 FROM business_types bt WHERE bt.label = t.label
);
