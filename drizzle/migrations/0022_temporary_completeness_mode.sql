CREATE TABLE public.test_mode_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enabled boolean NOT NULL, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.test_mode_events TO authenticated;
GRANT ALL ON public.test_mode_events TO service_role;
ALTER TABLE public.test_mode_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read mode audit" ON public.test_mode_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.test_mode_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT value->'enabled'='true'::jsonb FROM public.app_settings WHERE key='temporary_completeness_mode'),false); $$;
REVOKE ALL ON FUNCTION public.test_mode_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.test_mode_enabled() TO service_role;
CREATE OR REPLACE FUNCTION public.get_test_mode() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; RETURN jsonb_build_object('enabled',public.test_mode_enabled(),'updated_at',(SELECT updated_at FROM public.app_settings WHERE key='temporary_completeness_mode')); END; $$;
REVOKE ALL ON FUNCTION public.get_test_mode() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_test_mode() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_test_mode_setting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.key<>'temporary_completeness_mode' THEN RETURN NEW; END IF; IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator required'; END IF; IF jsonb_typeof(NEW.value->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid mode'; END IF; NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); INSERT INTO public.test_mode_events(enabled,actor_id) VALUES((NEW.value->>'enabled')::boolean,auth.uid()); RETURN NEW; END; $$;
CREATE TRIGGER audit_test_mode_setting BEFORE INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.guard_test_mode_setting();
CREATE OR REPLACE FUNCTION public.set_test_mode(_enabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator required'; END IF; IF _enabled IS NULL THEN RAISE EXCEPTION 'Mode required'; END IF; INSERT INTO public.app_settings(key,value,updated_by) VALUES('temporary_completeness_mode',jsonb_build_object('enabled',_enabled),auth.uid()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=now(); RETURN public.get_test_mode(); END; $$;
REVOKE ALL ON FUNCTION public.set_test_mode(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_test_mode(boolean) TO authenticated;
CREATE TABLE public.operational_form_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('work')), data jsonb NOT NULL DEFAULT '{}'::jsonb, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_record_id uuid, deleted_at timestamptz);
GRANT SELECT,INSERT,UPDATE ON public.operational_form_drafts TO authenticated;
GRANT ALL ON public.operational_form_drafts TO service_role;
ALTER TABLE public.operational_form_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read incomplete forms" ON public.operational_form_drafts FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Staff save incomplete forms" ON public.operational_form_drafts FOR INSERT TO authenticated WITH CHECK(public.is_staff(auth.uid()) AND created_by=auth.uid());
CREATE POLICY "Staff complete incomplete forms" ON public.operational_form_drafts FOR UPDATE TO authenticated USING(public.is_staff(auth.uid())) WITH CHECK(public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.guard_operational_form_draft() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF TG_OP='INSERT' AND NOT public.test_mode_enabled() THEN RAISE EXCEPTION 'Test mode disabled'; END IF; IF jsonb_typeof(NEW.data)<>'object' OR octet_length(NEW.data::text)>65536 THEN RAISE EXCEPTION 'Invalid draft'; END IF; IF TG_OP='UPDATE' THEN NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; END IF; NEW.updated_at:=now(); RETURN NEW; END; $$;
CREATE TRIGGER guard_operational_form_draft BEFORE INSERT OR UPDATE ON public.operational_form_drafts FOR EACH ROW EXECUTE FUNCTION public.guard_operational_form_draft();
ALTER TABLE public.orders ADD COLUMN completeness_pending text[] NOT NULL DEFAULT '{}', ADD COLUMN created_in_test_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN completeness_pending text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.clients ADD COLUMN completeness_pending text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.vehicles ADD COLUMN completeness_pending text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.works ADD COLUMN completeness_pending text[] NOT NULL DEFAULT '{}';
GRANT SELECT(completeness_pending) ON public.drivers TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_registration_duplicates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p text; doc text; raw_phone text; BEGIN
 IF TG_TABLE_NAME='drivers' THEN raw_phone:=NEW.phone;doc:=regexp_replace(coalesce(NEW.cpf,''),'[^0-9]','','g'); ELSE raw_phone:=NEW.contact_phone;doc:=regexp_replace(coalesce(NEW.document,''),'[^0-9]','','g'); END IF;
 p:=public.normalize_registration_phone(raw_phone);
 IF p IS NULL AND coalesce(trim(raw_phone),'')<>'' THEN RAISE EXCEPTION 'Telefone brasileiro inválido'; END IF;
 IF p IS NULL AND auth.uid() IS NOT NULL AND NOT public.test_mode_enabled() AND (TG_OP='INSERT' OR coalesce(trim(raw_phone),'')<>coalesce(CASE WHEN TG_TABLE_NAME='drivers' THEN to_jsonb(OLD)->>'phone' ELSE to_jsonb(OLD)->>'contact_phone' END,'')) THEN RAISE EXCEPTION 'Telefone brasileiro obrigatório'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(p,'')||TG_TABLE_NAME,0)); IF doc<>'' THEN PERFORM pg_advisory_xact_lock(hashtextextended(doc||TG_TABLE_NAME,0)); END IF;
 IF TG_TABLE_NAME='drivers' THEN
 IF EXISTS(SELECT 1 FROM public.drivers WHERE user_id<>NEW.user_id AND deleted_at IS NULL AND ((p IS NOT NULL AND public.normalize_registration_phone(phone)=p) OR (doc<>'' AND regexp_replace(coalesce(cpf,''),'[^0-9]','','g')=doc))) THEN RAISE EXCEPTION 'Motorista já cadastrado: consulte por telefone ou CPF'; END IF; IF p IS NOT NULL THEN NEW.phone:=p; END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM public.clients WHERE user_id<>NEW.user_id AND deleted_at IS NULL AND ((p IS NOT NULL AND public.normalize_registration_phone(contact_phone)=p) OR (doc<>'' AND regexp_replace(coalesce(document,''),'[^0-9]','','g')=doc))) THEN RAISE EXCEPTION 'Cliente já cadastrado: consulte por telefone ou documento'; END IF; IF p IS NOT NULL THEN NEW.contact_phone:=p; END IF;
 END IF; RETURN NEW; END; $$;
ALTER TABLE public.vehicles ADD COLUMN registration_plate text;
UPDATE public.vehicles SET registration_plate=plate;
COMMENT ON COLUMN public.vehicles.registration_plate IS 'Nullable registration value; empty legacy plate denotes missing information, never a fabricated registration.';
ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_plate_key;
CREATE UNIQUE INDEX vehicles_known_plate_unique ON public.vehicles(plate) WHERE trim(plate)<>'';
CREATE OR REPLACE FUNCTION public.track_record_completeness() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE pending text[]:='{}'; r jsonb:=to_jsonb(NEW); mode boolean:=public.test_mode_enabled(); BEGIN
 IF TG_TABLE_NAME IN ('drivers','clients') THEN
 IF coalesce(trim(r->>'full_name'),'')='' THEN pending:=array_append(pending,'Nome pendente'); END IF;
 IF coalesce(trim(CASE WHEN TG_TABLE_NAME='drivers' THEN r->>'phone' ELSE r->>'contact_phone' END),'')='' THEN pending:=array_append(pending,'Telefone pendente'); END IF;
 ELSIF TG_TABLE_NAME='vehicles' THEN
 IF coalesce(trim(NEW.plate),'')='' THEN pending:=array_append(pending,'Placa pendente'); END IF; NEW.registration_plate:=nullif(trim(NEW.plate),'');
 ELSIF TG_TABLE_NAME='works' THEN
 IF coalesce(trim(NEW.name),'')='' THEN pending:=array_append(pending,'Nome da obra pendente'); END IF;
 IF coalesce(trim(NEW.address),'')='' OR NEW.latitude IS NULL OR NEW.longitude IS NULL THEN pending:=array_append(pending,'Localização pendente'); END IF;
 ELSIF TG_TABLE_NAME='orders' THEN
 IF coalesce(trim(NEW.client_name),'')='' THEN pending:=array_append(pending,'Cliente pendente'); END IF;
 IF coalesce(trim(NEW.origin_address),'')='' OR coalesce(NEW.origin_location_details->>'precision','unconfirmed') NOT IN ('manual','address') THEN pending:=array_append(pending,'Coleta pendente'); END IF;
 IF coalesce(trim(NEW.destination_address),'')='' OR coalesce(NEW.destination_location_details->>'precision','unconfirmed') NOT IN ('manual','address') THEN pending:=array_append(pending,'Entrega pendente'); END IF;
 IF NEW.origin_lat IS NULL OR NEW.origin_lng IS NULL OR NEW.destination_lat IS NULL OR NEW.destination_lng IS NULL OR NEW.route_geometry IS NULL THEN pending:=array_append(pending,'Rota pendente'); END IF;
 IF NEW.price IS NULL THEN pending:=array_append(pending,'Valor pendente'); END IF;
 IF TG_OP='INSERT' THEN NEW.created_in_test_mode:=mode; ELSE NEW.created_in_test_mode:=OLD.created_in_test_mode; END IF;
 END IF;
 NEW.completeness_pending:=pending;
 IF NOT mode AND TG_OP='INSERT' AND cardinality(pending)>0 THEN RAISE EXCEPTION 'Informações obrigatórias pendentes: %',array_to_string(pending,', '); END IF;
 IF TG_TABLE_NAME='orders' AND TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NOT mode AND NEW.status::text NOT IN ('planning','created','cancelled') AND cardinality(pending)>0 THEN RAISE EXCEPTION 'Complete os dados antes de operar em produção: %',array_to_string(pending,', '); END IF;
 RETURN NEW; END; $$;
CREATE TRIGGER record_completeness BEFORE INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.track_record_completeness();
CREATE TRIGGER record_completeness BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.track_record_completeness();
CREATE TRIGGER record_completeness BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.track_record_completeness();
CREATE TRIGGER record_completeness BEFORE INSERT OR UPDATE ON public.works FOR EACH ROW EXECUTE FUNCTION public.track_record_completeness();
CREATE TRIGGER record_completeness BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.track_record_completeness();
CREATE OR REPLACE FUNCTION public.guard_stage_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status::text NOT IN ('loaded','delivered') THEN RETURN NEW; END IF; IF NOT public.test_mode_enabled() THEN
 IF NEW.status::text='loaded' AND (NOT EXISTS(SELECT 1 FROM public.order_attachments WHERE order_id=NEW.id AND event_status='loaded' AND kind='foto_carga') OR NOT EXISTS(SELECT 1 FROM public.order_attachments WHERE order_id=NEW.id AND event_status='loaded' AND kind='foto_nf')) THEN RAISE EXCEPTION 'Fotos da carga e nota fiscal pendentes'; END IF;
 IF NEW.status::text='delivered' AND (NOT EXISTS(SELECT 1 FROM public.deliveries WHERE order_id=NEW.id AND trim(coalesce(receiver_name,''))<>'') OR NOT EXISTS(SELECT 1 FROM public.order_attachments WHERE order_id=NEW.id AND event_status='delivered' AND kind IN ('canhoto','foto_entrega'))) THEN RAISE EXCEPTION 'Recebedor e comprovante pendentes'; END IF;
 END IF;
 IF public.test_mode_enabled() THEN INSERT INTO public.order_events(order_id,event_type,actor_id,from_status,to_status,payload) VALUES(NEW.id,'test_stage_confirmed',auth.uid(),OLD.status,NEW.status,jsonb_build_object('test_mode',true,'document_pending',NOT EXISTS(SELECT 1 FROM public.order_attachments WHERE order_id=NEW.id AND event_status=NEW.status::text))); END IF; RETURN NEW; END; $$;
CREATE TRIGGER stage_evidence_completeness BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_stage_evidence();