CREATE TABLE public.operational_identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
GRANT SELECT ON public.operational_identities TO authenticated;
GRANT ALL ON public.operational_identities TO service_role;
ALTER TABLE public.operational_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY operational_identity_read ON public.operational_identities FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR auth_user_id=auth.uid());
INSERT INTO public.operational_identities(id,auth_user_id)
SELECT id,id FROM public.profiles UNION SELECT user_id,user_id FROM public.drivers UNION SELECT user_id,user_id FROM public.clients ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.drivers ADD COLUMN full_name text, ADD COLUMN phone_verified boolean NOT NULL DEFAULT false, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.clients ADD COLUMN full_name text, ADD COLUMN customer_type text NOT NULL DEFAULT 'pj' CHECK(customer_type IN ('pf','pj')), ADD COLUMN trade_name text, ADD COLUMN address text, ADD COLUMN address_number text, ADD COLUMN neighborhood text, ADD COLUMN city text, ADD COLUMN state text, ADD COLUMN zip_code text, ADD COLUMN contact_name text, ADD COLUMN contacts jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN notes text, ADD COLUMN registration_status text NOT NULL DEFAULT 'pending' CHECK(registration_status IN ('pending','active','blocked')), ADD COLUMN phone_verified boolean NOT NULL DEFAULT false, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN deleted_at timestamptz;
UPDATE public.drivers d SET full_name=p.full_name FROM public.profiles p WHERE p.id=d.user_id;
UPDATE public.clients c SET full_name=p.full_name,address=p.address,address_number=p.address_number,neighborhood=p.neighborhood,city=p.city,state=p.state,zip_code=p.zip_code,contact_phone=coalesce(c.contact_phone,p.phone),contact_email=coalesce(c.contact_email,p.email) FROM public.profiles p WHERE p.id=c.user_id;
ALTER TABLE public.drivers DROP CONSTRAINT drivers_user_id_fkey, ADD CONSTRAINT drivers_operational_identity_fkey FOREIGN KEY(user_id) REFERENCES public.operational_identities(id);
ALTER TABLE public.clients DROP CONSTRAINT clients_user_id_fkey, ADD CONSTRAINT clients_operational_identity_fkey FOREIGN KEY(user_id) REFERENCES public.operational_identities(id);
CREATE FUNCTION public.ensure_operational_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.operational_identities(id,auth_user_id) VALUES(NEW.user_id,CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.user_id) THEN NEW.user_id ELSE NULL END) ON CONFLICT(id) DO NOTHING;
 NEW.full_name:=coalesce(NEW.full_name,(SELECT full_name FROM public.profiles WHERE id=NEW.user_id));
 RETURN NEW;
END $$;
CREATE TRIGGER ensure_driver_operational_identity BEFORE INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.ensure_operational_identity();
CREATE TRIGGER ensure_client_operational_identity BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.ensure_operational_identity();
CREATE FUNCTION public.guard_registration_permissions() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
  IF TG_TABLE_NAME='drivers' AND (NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'Somente administrador pode alterar aprovação'; END IF;
  IF TG_TABLE_NAME='clients' AND NEW.registration_status IS DISTINCT FROM OLD.registration_status THEN RAISE EXCEPTION 'Somente administrador pode alterar situação'; END IF;
  IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN RAISE EXCEPTION 'Verificação de telefone não autorizada'; END IF;
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER guard_driver_registration BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.guard_registration_permissions();
CREATE TRIGGER guard_client_registration BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_registration_permissions();
CREATE FUNCTION public.normalize_registration_phone(_phone text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN length(d) IN (10,11) THEN '+55'||d WHEN length(d) IN (12,13) AND left(d,2)='55' THEN '+'||d ELSE NULL END FROM (SELECT regexp_replace(coalesce(_phone,''),'[^0-9]','','g') d) s $$;
CREATE INDEX drivers_normalized_phone_idx ON public.drivers(public.normalize_registration_phone(phone));
CREATE INDEX clients_normalized_phone_idx ON public.clients(public.normalize_registration_phone(contact_phone));
CREATE INDEX drivers_document_idx ON public.drivers((regexp_replace(coalesce(cpf,''),'[^0-9]','','g')));
CREATE INDEX clients_document_idx ON public.clients((regexp_replace(coalesce(document,''),'[^0-9]','','g')));
CREATE FUNCTION public.guard_registration_duplicates() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p text; doc text; BEGIN
 IF TG_TABLE_NAME='drivers' THEN p:=public.normalize_registration_phone(NEW.phone);doc:=regexp_replace(coalesce(NEW.cpf,''),'[^0-9]','','g');
 ELSE p:=public.normalize_registration_phone(NEW.contact_phone);doc:=regexp_replace(coalesce(NEW.document,''),'[^0-9]','','g'); END IF;
 IF p IS NULL AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Telefone brasileiro obrigatório'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p,'')||TG_TABLE_NAME,0));
 IF doc<>'' THEN PERFORM pg_advisory_xact_lock(hashtextextended(doc||TG_TABLE_NAME,0)); END IF;
 IF TG_TABLE_NAME='drivers' THEN
  IF EXISTS(SELECT 1 FROM public.drivers WHERE user_id<>NEW.user_id AND deleted_at IS NULL AND ((p IS NOT NULL AND public.normalize_registration_phone(phone)=p) OR (doc<>'' AND regexp_replace(coalesce(cpf,''),'[^0-9]','','g')=doc))) THEN RAISE EXCEPTION 'Motorista já cadastrado: consulte por telefone ou CPF'; END IF;
  IF p IS NOT NULL THEN NEW.phone:=p; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.clients WHERE user_id<>NEW.user_id AND deleted_at IS NULL AND ((p IS NOT NULL AND public.normalize_registration_phone(contact_phone)=p) OR (doc<>'' AND regexp_replace(coalesce(document,''),'[^0-9]','','g')=doc))) THEN RAISE EXCEPTION 'Cliente já cadastrado: consulte por telefone ou documento'; END IF;
  IF p IS NOT NULL THEN NEW.contact_phone:=p; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER registration_driver_duplicates BEFORE INSERT OR UPDATE OF phone,cpf ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.guard_registration_duplicates();
CREATE TRIGGER registration_client_duplicates BEFORE INSERT OR UPDATE OF contact_phone,document ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_registration_duplicates();
CREATE FUNCTION public.guard_approved_offer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status::text IN ('pending','negotiating','accepted') AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.expires_at IS DISTINCT FROM OLD.expires_at) AND NOT EXISTS(SELECT 1 FROM public.drivers WHERE user_id=NEW.driver_id AND approval_status='active' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Ofertas somente para motoristas aprovados'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER approved_driver_offers BEFORE INSERT OR UPDATE ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.guard_approved_offer();
CREATE OR REPLACE FUNCTION public.notify_freight_offer_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status::text='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.expires_at IS DISTINCT FROM NEW.expires_at) AND EXISTS(SELECT 1 FROM public.drivers d JOIN public.operational_identities i ON i.id=d.user_id WHERE d.user_id=NEW.driver_id AND d.approval_status='active' AND i.auth_user_id=d.user_id) THEN
 INSERT INTO public.notifications(user_id,type,title,body,data) VALUES(NEW.driver_id,'new_offer','Nova rota disponível','Abra o aplicativo para consultar.',jsonb_build_object('order_id',NEW.order_id,'offer_id',NEW.id)); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ensure_operational_identity(),public.guard_registration_permissions(),public.guard_registration_duplicates(),public.guard_approved_offer() FROM PUBLIC;
COMMENT ON COLUMN public.drivers.user_id IS 'Stable operational identity; may exist before an Auth account. Activation uses the same UUID.';
COMMENT ON COLUMN public.clients.user_id IS 'Stable operational identity; may exist before an Auth account. Activation uses the same UUID.';