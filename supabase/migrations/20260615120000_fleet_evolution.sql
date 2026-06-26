-- Create public.tachograph_records table with soft delete and timestamptz
CREATE TABLE IF NOT EXISTS public.tachograph_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id bigint REFERENCES public.employees(id) ON DELETE CASCADE,
  vehicle_id bigint REFERENCES public.vehicles(id) ON DELETE CASCADE,
  reading_date date NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  km_start numeric NOT NULL,
  km_end numeric NOT NULL,
  total_km numeric GENERATED ALWAYS AS (km_end - km_start) STORED,
  total_hours numeric NOT NULL,
  observations text,
  disk_image_path text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  created_by bigint REFERENCES public.employees(id),
  updated_by bigint REFERENCES public.employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_km CHECK (km_end >= km_start),
  CONSTRAINT chk_dates CHECK (end_at > start_at)
);

-- Create public.audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint REFERENCES public.employees(id) ON DELETE SET NULL,
  entity varchar(50) NOT NULL,
  entity_id uuid,
  action varchar(20) NOT NULL,
  old_data jsonb,
  new_data jsonb,
  ip varchar(45),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create public.user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint REFERENCES public.employees(id) ON DELETE CASCADE,
  device varchar(50),
  ip varchar(45),
  refresh_token_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_activity timestamptz DEFAULT now()
);

-- Create public.notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'INFO',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_tachograph_driver ON public.tachograph_records(driver_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tachograph_vehicle ON public.tachograph_records(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON public.user_sessions(refresh_token_hash);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;


ALTER TABLE public.vehicle_checklists ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.vehicle_checklists ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'APPROVED';

