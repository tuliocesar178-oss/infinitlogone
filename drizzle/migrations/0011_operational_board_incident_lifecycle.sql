ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz, ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES public.profiles(id), ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id), ADD COLUMN IF NOT EXISTS operational_notes text, ADD COLUMN IF NOT EXISTS alert_key text, ADD COLUMN IF NOT EXISTS alert_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS incidents_alert_key_unique ON public.incidents(alert_key) WHERE alert_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS incidents_assigned_to_idx ON public.incidents(assigned_to);
CREATE OR REPLACE FUNCTION public.can_manage_operation_board(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user AND role IN ('admin','logistics','supervisor','operacional')); $$;
REVOKE ALL ON FUNCTION public.can_manage_operation_board(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_manage_operation_board(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.guard_board_incident_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF (TG_OP='INSERT' AND (NEW.alert_key IS NOT NULL OR NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL OR NEW.assigned_to IS NOT NULL OR NEW.operational_notes IS NOT NULL)) OR (TG_OP='UPDATE' AND (NEW.acknowledged_at,NEW.acknowledged_by,NEW.assigned_to,NEW.operational_notes,NEW.alert_key,NEW.alert_metadata) IS DISTINCT FROM (OLD.acknowledged_at,OLD.acknowledged_by,OLD.assigned_to,OLD.operational_notes,OLD.alert_key,OLD.alert_metadata)) THEN
IF auth.uid() IS NOT NULL AND NOT public.can_manage_operation_board(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
END IF; RETURN NEW; END; $$;
CREATE TRIGGER guard_board_incident_fields BEFORE INSERT OR UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.guard_board_incident_fields();
CREATE OR REPLACE FUNCTION public.sync_operation_board_alerts(_alerts jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a jsonb; oid uuid; inserted_id uuid; BEGIN
IF NOT public.can_manage_operation_board(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
IF jsonb_typeof(_alerts) <> 'array' OR jsonb_array_length(_alerts)>500 THEN RAISE EXCEPTION 'Invalid alerts'; END IF;
FOR a IN SELECT value FROM jsonb_array_elements(_alerts) LOOP
 oid := (a->>'order_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=oid AND deleted_at IS NULL AND status NOT IN ('delivered','finalized','cancelled')) THEN CONTINUE; END IF;
 IF a->>'type' NOT IN ('route_deviation','prolonged_stop','gps_lost','delivery_late','deadline_near') OR length(a->>'alert_key') NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Invalid alert'; END IF;
 inserted_id := NULL;
 INSERT INTO public.incidents(order_id,reported_by,type,description,severity,alert_key,alert_metadata)
 VALUES(oid,auth.uid(),a->>'type',left(a->>'description',2000),CASE WHEN a->>'severity'='high' THEN 'high' ELSE 'medium' END,a->>'alert_key',coalesce(a->'metadata','{}'::jsonb))
 ON CONFLICT(alert_key) WHERE alert_key IS NOT NULL DO NOTHING RETURNING id INTO inserted_id;
 IF inserted_id IS NOT NULL THEN INSERT INTO public.order_events(order_id,event_type,actor_id,payload) VALUES(oid,'operational_alert_created',auth.uid(),jsonb_build_object('incident_id',inserted_id,'type',a->>'type','alert_key',a->>'alert_key')); END IF;
END LOOP; END; $$;
REVOKE ALL ON FUNCTION public.sync_operation_board_alerts(jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.sync_operation_board_alerts(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.manage_operation_board_incident(_id uuid,_action text,_assigned_to uuid DEFAULT NULL,_notes text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i public.incidents; BEGIN
IF NOT public.can_manage_operation_board(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
SELECT * INTO i FROM public.incidents WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;
IF _action NOT IN ('acknowledge','assign','note','resolve') THEN RAISE EXCEPTION 'Invalid action'; END IF;
IF _assigned_to IS NOT NULL AND NOT public.can_manage_operation_board(_assigned_to) THEN RAISE EXCEPTION 'Invalid assignee'; END IF;
IF _action IN ('note','resolve') AND length(trim(coalesce(_notes,'')))=0 THEN RAISE EXCEPTION 'Notes required'; END IF;
UPDATE public.incidents SET acknowledged_at=CASE WHEN _action='acknowledge' THEN coalesce(acknowledged_at,now()) ELSE acknowledged_at END, acknowledged_by=CASE WHEN _action='acknowledge' THEN coalesce(acknowledged_by,auth.uid()) ELSE acknowledged_by END, assigned_to=CASE WHEN _action='assign' THEN _assigned_to ELSE assigned_to END, operational_notes=CASE WHEN _notes IS NOT NULL THEN left(_notes,4000) ELSE operational_notes END, resolved_at=CASE WHEN _action='resolve' THEN coalesce(resolved_at,now()) ELSE resolved_at END WHERE id=_id;
INSERT INTO public.order_events(order_id,event_type,actor_id,payload) VALUES(i.order_id,'operational_alert_'||_action,auth.uid(),jsonb_build_object('incident_id',i.id,'assigned_to',_assigned_to,'notes',left(_notes,4000),'previous_notes',i.operational_notes)); END; $$;
REVOKE ALL ON FUNCTION public.manage_operation_board_incident(uuid,text,uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.manage_operation_board_incident(uuid,text,uuid,text) TO authenticated;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['incidents','order_events','order_tracking_points','app_settings'] LOOP IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF; END LOOP; END $$;