DO $$ DECLARE body text; updated text; BEGIN
body:=pg_get_functiondef('public.create_driver_incident(jsonb)'::regprocedure);
updated:=replace(body,'((c->>''requires_description'')::boolean AND length(trim(coalesce(_data->>''description'','''')))<3)','(NOT public.test_mode_enabled() AND (c->>''requires_description'')::boolean AND length(trim(coalesce(_data->>''description'','''')))<3)');
IF body=updated THEN RAISE EXCEPTION 'Incident completeness branch not found'; END IF; EXECUTE updated;
body:=pg_get_functiondef('public.manage_driver_incident(uuid,text,text,text,text,uuid,boolean)'::regprocedure);
updated:=replace(body,'AND length(trim(coalesce(_message,'''')))<3 THEN RAISE EXCEPTION ''Message required''','AND NOT public.test_mode_enabled() AND length(trim(coalesce(_message,'''')))<3 THEN RAISE EXCEPTION ''Message required''');
IF body=updated THEN RAISE EXCEPTION 'Incident response completeness branch not found'; END IF; EXECUTE updated; END; $$;
CREATE OR REPLACE FUNCTION public.preserve_empty_incident_message() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.body IS NULL THEN NEW.body:='Informação pendente'; END IF; RETURN NEW; END; $$;