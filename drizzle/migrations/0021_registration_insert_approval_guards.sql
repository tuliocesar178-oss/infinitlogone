CREATE OR REPLACE FUNCTION public.guard_driver_financial_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND auth.uid()<>NEW.user_id AND NOT public.has_role(auth.uid(),'admin') THEN
 IF TG_OP='INSERT' AND NEW.pix_key IS NOT NULL THEN RAISE EXCEPTION 'Dados financeiros exigem administrador'; END IF;
 IF TG_OP='UPDATE' AND NEW.pix_key IS DISTINCT FROM OLD.pix_key THEN RAISE EXCEPTION 'Dados financeiros exigem administrador'; END IF;
 END IF; RETURN NEW; END $$;
CREATE FUNCTION public.guard_registration_insert_approval() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
  IF TG_TABLE_NAME='drivers' AND (NEW.approval_status<>'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'Aprovação exige administrador'; END IF;
  IF TG_TABLE_NAME='clients' AND NEW.registration_status<>'pending' THEN RAISE EXCEPTION 'Situação exige administrador'; END IF;
  IF NEW.phone_verified THEN RAISE EXCEPTION 'Telefone não verificado'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER registration_driver_insert_approval BEFORE INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.guard_registration_insert_approval();
CREATE TRIGGER registration_client_insert_approval BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_registration_insert_approval();