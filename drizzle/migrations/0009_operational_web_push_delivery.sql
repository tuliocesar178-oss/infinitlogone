CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE public.push_transport_config (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE CHECK(key='web_push'), endpoint text NOT NULL, bearer text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz);
GRANT ALL ON public.push_transport_config TO service_role;
REVOKE ALL ON public.push_transport_config FROM anon, authenticated;
ALTER TABLE public.push_transport_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ADD COLUMN preferences jsonb NOT NULL DEFAULT '{"offers":true,"routes":true,"chat":true,"incidents":true,"registrations":true,"finance":true}'::jsonb;
CREATE POLICY "Device secrets owner only" ON public.push_subscriptions AS RESTRICTIVE FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
ALTER TABLE public.notifications ADD COLUMN push_status text NOT NULL DEFAULT 'not_requested' CHECK(push_status IN ('not_requested','pending','processing','accepted','skipped','failed'));
ALTER TABLE public.notifications ADD COLUMN push_error text;
ALTER TABLE public.notifications ADD COLUMN push_processed_at timestamptz;
CREATE TABLE public.push_deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE, subscription_id uuid NOT NULL, status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','accepted','failed','expired')), provider_status integer, attempts integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(notification_id,subscription_id));
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX push_deliveries_subscription_idx ON public.push_deliveries(subscription_id);
CREATE INDEX notifications_push_status_idx ON public.notifications(push_status) WHERE push_status IN ('pending','failed');
CREATE OR REPLACE FUNCTION public.enqueue_notification_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.push_transport_config%ROWTYPE; BEGIN
 SELECT * INTO c FROM public.push_transport_config WHERE key='web_push' AND deleted_at IS NULL;
 NEW.push_status:='pending';
 IF c.id IS NOT NULL THEN PERFORM net.http_post(url:=c.endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||c.bearer),body:=jsonb_build_object('notification_id',NEW.id),timeout_milliseconds:=10000); END IF;
 RETURN NEW;
 EXCEPTION WHEN OTHERS THEN NEW.push_status:='failed'; NEW.push_error:='Falha ao solicitar envio'; RETURN NEW; END $$;
CREATE TRIGGER enqueue_notification_push BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_push();
CREATE OR REPLACE FUNCTION public.claim_push_delivery(_notification uuid,_subscription uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target uuid; BEGIN INSERT INTO public.push_deliveries(notification_id,subscription_id) VALUES(_notification,_subscription) ON CONFLICT DO NOTHING RETURNING id INTO target; RETURN target; END $$;
REVOKE ALL ON FUNCTION public.claim_push_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_operational_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE oid uuid; owner_id uuid; assigned uuid; kind text; BEGIN
 IF TG_TABLE_NAME='orders' THEN
 IF NEW.status IS NOT DISTINCT FROM OLD.status AND ROW(NEW.origin_address,NEW.origin_number,NEW.destination_address,NEW.destination_number,NEW.scheduled_at) IS NOT DISTINCT FROM ROW(OLD.origin_address,OLD.origin_number,OLD.destination_address,OLD.destination_number,OLD.scheduled_at) THEN RETURN NEW; END IF;
 oid:=NEW.id; owner_id:=NEW.created_by; assigned:=NEW.driver_id;
 kind:=CASE WHEN NEW.status::text='cancelled' THEN 'route_cancelled' WHEN NEW.status::text='incident' THEN 'route_incident' ELSE 'route_update' END;
 ELSIF TG_TABLE_NAME IN ('order_attachments','incidents') THEN
 oid:=NEW.order_id; SELECT created_by,driver_id INTO owner_id,assigned FROM public.orders WHERE id=oid;
 kind:=CASE WHEN TG_TABLE_NAME='incidents' THEN 'route_incident' ELSE 'evidence_uploaded' END;
 END IF;
 IF owner_id IS NOT NULL AND public.is_staff(owner_id) AND owner_id IS DISTINCT FROM auth.uid() THEN INSERT INTO public.notifications(user_id,type,title,body,data) VALUES(owner_id,kind,'Atualização da operação','Abra o aplicativo para consultar.',jsonb_build_object('order_id',oid)); END IF;
 IF assigned IS NOT NULL AND assigned IS DISTINCT FROM auth.uid() AND kind IN ('route_update','route_cancelled','route_incident') THEN INSERT INTO public.notifications(user_id,type,title,body,data) VALUES(assigned,kind,'Atualização da rota','Abra o aplicativo para consultar.',jsonb_build_object('order_id',oid)); END IF;
 IF kind='route_incident' THEN INSERT INTO public.notifications(user_id,type,title,body,data) SELECT DISTINCT user_id,'critical_incident','Ocorrência operacional','Abra o aplicativo para consultar.',jsonb_build_object('order_id',oid) FROM public.user_roles WHERE role='admin' AND user_id IS DISTINCT FROM owner_id AND user_id IS DISTINCT FROM auth.uid(); END IF;
 RETURN NEW; END $$;
CREATE TRIGGER operational_order_push AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_operational_change();
CREATE TRIGGER operational_evidence_push AFTER INSERT ON public.order_attachments FOR EACH ROW EXECUTE FUNCTION public.notify_operational_change();
CREATE TRIGGER operational_incident_push AFTER INSERT ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.notify_operational_change();
CREATE OR REPLACE FUNCTION public.notify_driver_registration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.approval_status::text='pending' THEN INSERT INTO public.notifications(user_id,type,title,body,data) SELECT DISTINCT user_id,'driver_registration','Cadastro aguardando análise','Abra o aplicativo para analisar o cadastro.',jsonb_build_object('driver_id',NEW.user_id) FROM public.user_roles WHERE role='admin'; END IF; RETURN NEW; END $$;
CREATE TRIGGER driver_registration_push AFTER INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.notify_driver_registration();