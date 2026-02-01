-- Add journey_id linkage for incidents to enable traceability with journeys.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS journey_id bigint;

DO $$
BEGIN
  ALTER TABLE public.incidents
    ADD CONSTRAINT incidents_journey_id_fkey
    FOREIGN KEY (journey_id)
    REFERENCES public.journeys(id);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
