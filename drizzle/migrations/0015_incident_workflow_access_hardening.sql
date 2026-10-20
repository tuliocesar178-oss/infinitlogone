ALTER POLICY incidents_rpc_insert_only ON public.incidents WITH CHECK(false);
ALTER POLICY incidents_rpc_update_only ON public.incidents USING(false) WITH CHECK(false);
CREATE POLICY incidents_reporter_read ON public.incidents FOR SELECT TO authenticated USING(reported_by=auth.uid());
DROP TRIGGER operational_incident_push ON public.incidents;
CREATE TRIGGER operational_incident_push AFTER INSERT ON public.incidents FOR EACH ROW WHEN (NEW.request_id IS NULL) EXECUTE FUNCTION public.notify_operational_change();
CREATE POLICY incident_events_rpc_insert ON public.order_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(event_type NOT LIKE 'driver_incident_%' AND event_type NOT LIKE 'operational_alert_%');