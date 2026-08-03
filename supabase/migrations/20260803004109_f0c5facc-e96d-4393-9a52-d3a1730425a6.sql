-- chat access helper is used inside RLS policies, so the caller needs EXECUTE
GRANT EXECUTE ON FUNCTION public.can_access_order_chat(uuid, uuid) TO authenticated;

-- Server-only variants that receive the acting user explicitly
CREATE OR REPLACE FUNCTION public.review_driver_signup_as(_actor uuid, _driver_id uuid, _decision text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _actor IS NULL OR NOT public.is_staff(_actor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _decision = 'approve' THEN
    UPDATE public.drivers
       SET approval_status = 'active', reviewed_at = now(), reviewed_by = _actor,
           rejection_reason = NULL, correction_notes = NULL
     WHERE user_id = _driver_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (_driver_id, 'driver')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (_driver_id, 'driver_approved', 'Cadastro aprovado',
            'Seu cadastro foi aprovado. Agora você já pode acessar o painel do motorista e receber ofertas.');
  ELSIF _decision = 'reject' THEN
    UPDATE public.drivers
       SET approval_status = 'rejected', reviewed_at = now(), reviewed_by = _actor,
           rejection_reason = _reason
     WHERE user_id = _driver_id;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (_driver_id, 'driver_rejected', 'Cadastro reprovado', COALESCE(_reason,'Seu cadastro foi reprovado.'));
  ELSIF _decision = 'correction' THEN
    UPDATE public.drivers
       SET approval_status = 'correction', reviewed_at = now(), reviewed_by = _actor,
           correction_notes = _reason
     WHERE user_id = _driver_id;
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (_driver_id, 'driver_correction', 'Correção solicitada', COALESCE(_reason,'Ajustes solicitados no seu cadastro.'));
  ELSE
    RAISE EXCEPTION 'invalid decision';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_driver_signup_as(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_driver_signup_as(uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.send_program_to_driver_as(_actor uuid, _program_id uuid, _driver_id uuid, _price numeric, _expires_minutes integer DEFAULT 15)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_offer_id uuid;
BEGIN
  IF _actor IS NULL OR NOT public.is_staff(_actor) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT order_id INTO v_order_id FROM public.freight_programs WHERE id = _program_id FOR UPDATE;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'programa nao encontrado';
  END IF;

  INSERT INTO public.freight_offers (order_id, driver_id, offered_price, status, expires_at)
  VALUES (v_order_id, _driver_id, _price, 'pending', now() + make_interval(mins => _expires_minutes))
  RETURNING id INTO v_offer_id;

  UPDATE public.freight_programs
     SET status = 'sent', sent_at = now(),
         freight_value = COALESCE(freight_value, _price), updated_at = now()
   WHERE id = _program_id;

  UPDATE public.orders
     SET status = CASE WHEN status = 'preparing' THEN 'awaiting_driver'::order_status ELSE status END,
         updated_at = now()
   WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, event_type, to_status, actor_id, payload)
  VALUES (v_order_id, 'program_sent', 'awaiting_driver', _actor,
          jsonb_build_object('program_id', _program_id, 'driver_id', _driver_id, 'price', _price));

  RETURN v_offer_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.send_program_to_driver_as(uuid, uuid, uuid, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_program_to_driver_as(uuid, uuid, uuid, numeric, integer) TO service_role;