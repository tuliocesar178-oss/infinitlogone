CREATE OR REPLACE FUNCTION public.validate_test_order_numbers() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF (NEW.price IS NOT NULL AND NEW.price<=0) OR (NEW.driver_amount IS NOT NULL AND NEW.driver_amount<=0) OR (NEW.client_amount IS NOT NULL AND NEW.client_amount<=0) OR (NEW.distance_km IS NOT NULL AND NEW.distance_km<0) OR (NEW.cargo_weight_kg IS NOT NULL AND NEW.cargo_weight_kg<0) THEN RAISE EXCEPTION 'Valores informados devem ser válidos; ausência fica pendente'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER test_order_numeric_integrity BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_test_order_numbers();
CREATE OR REPLACE FUNCTION public.guard_operational_form_draft() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' AND NOT public.test_mode_enabled() THEN RAISE EXCEPTION 'Test mode disabled'; END IF;
IF jsonb_typeof(NEW.data)<>'object' OR octet_length(NEW.data::text)>65536 OR NEW.kind<>'work' THEN RAISE EXCEPTION 'Invalid draft'; END IF;
IF TG_OP='UPDATE' THEN
NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at; NEW.kind:=OLD.kind;
IF OLD.completed_record_id IS NOT NULL THEN RAISE EXCEPTION 'Draft already completed'; END IF;
IF NEW.completed_record_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.works WHERE id=NEW.completed_record_id) THEN RAISE EXCEPTION 'Work not found'; END IF;
END IF; NEW.updated_at:=now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.preserve_empty_incident_message() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RETURN NEW; END; $$;
COMMENT ON FUNCTION public.preserve_empty_incident_message() IS 'Unused helper; no fabricated messages or evidence are inserted.';