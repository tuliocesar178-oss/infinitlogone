CREATE OR REPLACE FUNCTION public.review_driver_signup_as(_actor uuid,_driver_id uuid,_decision text,_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _actor IS NULL OR NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Somente administrador pode alterar aprovação'; END IF;
 IF _decision NOT IN ('approve','reject','correction') THEN RAISE EXCEPTION 'invalid decision'; END IF;
 UPDATE public.drivers SET approval_status=CASE _decision WHEN 'approve' THEN 'active'::driver_approval_status WHEN 'reject' THEN 'rejected'::driver_approval_status ELSE 'correction'::driver_approval_status END,reviewed_at=now(),reviewed_by=_actor,rejection_reason=CASE WHEN _decision='reject' THEN _reason END,correction_notes=CASE WHEN _decision='correction' THEN _reason END WHERE user_id=_driver_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Motorista não encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM public.operational_identities WHERE id=_driver_id AND auth_user_id=_driver_id) THEN
  IF _decision='approve' THEN INSERT INTO public.user_roles(user_id,role) VALUES(_driver_id,'driver') ON CONFLICT(user_id,role) DO NOTHING; END IF;
  INSERT INTO public.notifications(user_id,type,title,body) VALUES(_driver_id,CASE _decision WHEN 'approve' THEN 'driver_approved' WHEN 'reject' THEN 'driver_rejected' ELSE 'driver_correction' END,'Situação cadastral atualizada',coalesce(_reason,'Consulte seu cadastro.'));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_driver_signup_as(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_driver_signup_as(uuid,uuid,text,text) TO service_role;
ALTER TABLE public.driver_documents DROP CONSTRAINT driver_documents_driver_id_fkey, ADD CONSTRAINT driver_documents_identity_fkey FOREIGN KEY(driver_id) REFERENCES public.operational_identities(id);
CREATE FUNCTION public.guard_driver_financial_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
  IF TG_OP='INSERT' AND NEW.pix_key IS NOT NULL THEN RAISE EXCEPTION 'Dados financeiros exigem administrador'; END IF;
  IF TG_OP='UPDATE' AND NEW.pix_key IS DISTINCT FROM OLD.pix_key THEN RAISE EXCEPTION 'Dados financeiros exigem administrador'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_driver_financial_registration BEFORE INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.guard_driver_financial_registration();