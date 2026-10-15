REVOKE INSERT ON public.notifications FROM authenticated;
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE(read_at) ON public.notifications TO authenticated;
CREATE OR REPLACE FUNCTION public.notify_freight_offer_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status::text='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.expires_at IS DISTINCT FROM NEW.expires_at) THEN
 INSERT INTO public.notifications(user_id,type,title,body,data) VALUES(NEW.driver_id,'new_offer','Nova rota disponível','Abra o aplicativo para consultar.',jsonb_build_object('order_id',NEW.order_id,'offer_id',NEW.id));
 END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER freight_offer_push AFTER INSERT OR UPDATE ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.notify_freight_offer_push();
CREATE OR REPLACE FUNCTION public.notify_client_order_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.client_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,type,title,body,data) VALUES(NEW.client_id,'route_update','Atualização do frete','Abra o aplicativo para consultar.',jsonb_build_object('order_id',NEW.id)); END IF;
 RETURN NEW; END $$;
CREATE TRIGGER client_order_push AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_client_order_push();