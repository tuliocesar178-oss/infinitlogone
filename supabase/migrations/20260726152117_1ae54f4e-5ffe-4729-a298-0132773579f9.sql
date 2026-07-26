
-- Enum de status de aprovação
DO $$ BEGIN
  CREATE TYPE public.driver_approval_status AS ENUM ('pending','active','correction','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colunas de aprovação
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS approval_status public.driver_approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS correction_notes text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Atualiza handle_new_user: cria perfil e, se metadata indicar "driver_signup",
-- cria registro de motorista PENDENTE sem atribuir papel de driver ainda.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_driver_signup boolean := COALESCE((NEW.raw_user_meta_data->>'driver_signup')::boolean, false);
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'photo_url'
  )
  ON CONFLICT (id) DO NOTHING;

  IF is_driver_signup THEN
    INSERT INTO public.drivers (
      user_id, status, availability, approval_status,
      cpf, rg, phone, whatsapp, email, city, state, zip,
      address, license_number, license_category, cnh_expires_at,
      rntrc, pix_key, photo_url
    ) VALUES (
      NEW.id, 'offline', 'offline', 'pending',
      NEW.raw_user_meta_data->>'cpf',
      NEW.raw_user_meta_data->>'rg',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'whatsapp',
      NEW.email,
      NEW.raw_user_meta_data->>'city',
      NEW.raw_user_meta_data->>'state',
      NEW.raw_user_meta_data->>'zip',
      NEW.raw_user_meta_data->>'address',
      NEW.raw_user_meta_data->>'license_number',
      NEW.raw_user_meta_data->>'license_category',
      NULLIF(NEW.raw_user_meta_data->>'cnh_expires_at','')::date,
      NEW.raw_user_meta_data->>'rntrc',
      NEW.raw_user_meta_data->>'pix_key',
      NEW.raw_user_meta_data->>'photo_url'
    ) ON CONFLICT (user_id) DO NOTHING;
    -- NÃO atribui papel de driver aqui. Só após aprovação.
  END IF;

  RETURN NEW;
END;
$$;

-- RPC para admin/logística aprovar ou reprovar cadastro
CREATE OR REPLACE FUNCTION public.review_driver_signup(
  _driver_id uuid,
  _decision text,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _decision = 'approve' THEN
    UPDATE public.drivers
       SET approval_status = 'active',
           reviewed_at = now(),
           reviewed_by = auth.uid(),
           rejection_reason = NULL,
           correction_notes = NULL
     WHERE user_id = _driver_id;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_driver_id, 'driver')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (_driver_id, 'driver_approved',
            'Cadastro aprovado',
            'Seu cadastro foi aprovado. Agora você já pode acessar o painel do motorista e receber ofertas.');
  ELSIF _decision = 'reject' THEN
    UPDATE public.drivers
       SET approval_status = 'rejected',
           reviewed_at = now(),
           reviewed_by = auth.uid(),
           rejection_reason = _reason
     WHERE user_id = _driver_id;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (_driver_id, 'driver_rejected', 'Cadastro reprovado', COALESCE(_reason,'Seu cadastro foi reprovado.'));
  ELSIF _decision = 'correction' THEN
    UPDATE public.drivers
       SET approval_status = 'correction',
           reviewed_at = now(),
           reviewed_by = auth.uid(),
           correction_notes = _reason
     WHERE user_id = _driver_id;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (_driver_id, 'driver_correction', 'Correção solicitada', COALESCE(_reason,'Ajustes solicitados no seu cadastro.'));
  ELSE
    RAISE EXCEPTION 'invalid decision';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_driver_signup(uuid, text, text) TO authenticated;
