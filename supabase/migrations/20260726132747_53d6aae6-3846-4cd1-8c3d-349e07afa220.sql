
-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM (
    'disponivel','em_coleta','em_transito','em_entrega','retornando','manutencao','bloqueado','reserva','offline'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS chassis text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS capacity_m3 numeric,
  ADD COLUMN IF NOT EXISTS body_type text,
  ADD COLUMN IF NOT EXISTS insurance_company text,
  ADD COLUMN IF NOT EXISTS insurance_policy text,
  ADD COLUMN IF NOT EXISTS licensing_expires_at date,
  ADD COLUMN IF NOT EXISTS ipva_expires_at date,
  ADD COLUMN IF NOT EXISTS antt_number text,
  ADD COLUMN IF NOT EXISTS acquisition_date date,
  ADD COLUMN IF NOT EXISTS owner_company text,
  ADD COLUMN IF NOT EXISTS current_km numeric,
  ADD COLUMN IF NOT EXISTS current_city text,
  ADD COLUMN IF NOT EXISTS current_state text,
  ADD COLUMN IF NOT EXISTS current_lat double precision,
  ADD COLUMN IF NOT EXISTS current_lng double precision,
  ADD COLUMN IF NOT EXISTS current_speed_kmh double precision,
  ADD COLUMN IF NOT EXISTS battery_level integer,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS status public.vehicle_status NOT NULL DEFAULT 'disponivel',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger updated_at on vehicles
DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Vehicle types
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_types TO authenticated;
GRANT ALL ON public.vehicle_types TO service_role;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicle_types read auth" ON public.vehicle_types;
CREATE POLICY "vehicle_types read auth" ON public.vehicle_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vehicle_types staff write" ON public.vehicle_types;
CREATE POLICY "vehicle_types staff write" ON public.vehicle_types FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_vehicle_types_updated_at ON public.vehicle_types;
CREATE TRIGGER trg_vehicle_types_updated_at BEFORE UPDATE ON public.vehicle_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.vehicle_types (name) VALUES
  ('Caminhão 3/4'),('Toco'),('Truck'),('Bitruck'),('Carreta'),('Rodotrem'),
  ('VUC'),('Van'),('Utilitário'),('Fiorino'),('Moto'),('Outros')
ON CONFLICT (name) DO NOTHING;

-- Vehicle documents
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  expires_at date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicle_documents staff all" ON public.vehicle_documents;
CREATE POLICY "vehicle_documents staff all" ON public.vehicle_documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "vehicle_documents driver read" ON public.vehicle_documents;
CREATE POLICY "vehicle_documents driver read" ON public.vehicle_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_driver_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_vehicle_documents_updated_at ON public.vehicle_documents;
CREATE TRIGGER trg_vehicle_documents_updated_at BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Broader vehicles RLS (drop-and-recreate to ensure staff+driver visibility)
DROP POLICY IF EXISTS "vehicles staff all" ON public.vehicles;
CREATE POLICY "vehicles staff all" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "vehicles driver read own" ON public.vehicles;
CREATE POLICY "vehicles driver read own" ON public.vehicles FOR SELECT TO authenticated
  USING (owner_driver_id = auth.uid());
