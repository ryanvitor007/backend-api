-- Add missing columns to align database schema with backend requirements.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS marca text;

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS authorized_with_risk boolean DEFAULT false;

ALTER TABLE public.maintenances
  ADD COLUMN IF NOT EXISTS driver_id bigint;

DO $$
BEGIN
  ALTER TABLE public.maintenances
    ADD CONSTRAINT maintenances_driver_id_fkey
    FOREIGN KEY (driver_id)
    REFERENCES public.employees(id);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS photo text;
