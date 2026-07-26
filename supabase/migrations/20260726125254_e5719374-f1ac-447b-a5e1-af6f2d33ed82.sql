
DO $$ BEGIN
  CREATE TYPE public.driver_availability AS ENUM ('disponivel','em_frete','folga','ferias','bloqueado','offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cnh_issued_at date,
  ADD COLUMN IF NOT EXISTS antt_expires_at date,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS civil_status text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS availability public.driver_availability NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS rating numeric(3,2),
  ADD COLUMN IF NOT EXISTS daily_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS hourly_wait_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS owns_vehicle boolean NOT NULL DEFAULT false;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS max_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS axles integer,
  ADD COLUMN IF NOT EXISTS renavam text,
  ADD COLUMN IF NOT EXISTS crlv_expires_at date,
  ADD COLUMN IF NOT EXISTS insurance_expires_at date,
  ADD COLUMN IF NOT EXISTS antt_expires_at date,
  ADD COLUMN IF NOT EXISTS owner_driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  expires_at date,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver ON public.driver_documents(driver_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_documents TO authenticated;
GRANT ALL ON public.driver_documents TO service_role;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_documents manage" ON public.driver_documents;
CREATE POLICY "driver_documents manage" ON public.driver_documents
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR driver_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR driver_id = auth.uid());

DROP TRIGGER IF EXISTS trg_driver_documents_updated_at ON public.driver_documents;
CREATE TRIGGER trg_driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  score numeric(3,2) NOT NULL CHECK (score >= 0 AND score <= 5),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver ON public.driver_ratings(driver_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_ratings TO authenticated;
GRANT ALL ON public.driver_ratings TO service_role;
ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_ratings staff manage" ON public.driver_ratings;
CREATE POLICY "driver_ratings staff manage" ON public.driver_ratings
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "driver_ratings driver read own" ON public.driver_ratings;
CREATE POLICY "driver_ratings driver read own" ON public.driver_ratings
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='drivers' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drivers', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "drivers read" ON public.drivers
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "drivers insert staff" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "drivers update" ON public.drivers
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "drivers delete admin" ON public.drivers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "driver-docs staff all" ON storage.objects;
CREATE POLICY "driver-docs staff all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'driver-documents' AND (public.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text))
  WITH CHECK (bucket_id = 'driver-documents' AND (public.is_staff(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text));
