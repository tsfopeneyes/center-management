-- Additive only: existing school records and permissions are preserved.
BEGIN;
ALTER TABLE public.schools
    ADD COLUMN IF NOT EXISTS map_address text,
    ADD COLUMN IF NOT EXISTS map_latitude double precision,
    ADD COLUMN IF NOT EXISTS map_longitude double precision;
ALTER TABLE public.schools ADD CONSTRAINT schools_map_coordinates_valid CHECK (
    (map_latitude IS NULL AND map_longitude IS NULL) OR
    (map_latitude IS NOT NULL AND map_longitude IS NOT NULL AND
     map_latitude BETWEEN -90 AND 90 AND map_longitude BETWEEN -180 AND 180)
);
COMMENT ON COLUMN public.schools.map_address IS 'Operator-confirmed school address for the school management map';
NOTIFY pgrst, 'reload schema';
COMMIT;
