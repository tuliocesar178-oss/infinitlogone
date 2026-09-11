CREATE OR REPLACE FUNCTION public.submit_freight_counteroffer(
  _offer_id uuid,
  _amount numeric,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_offer public.freight_offers%ROWTYPE;
  v_negotiation_id uuid;
  v_is_staff boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor válido';
  END IF;

  SELECT * INTO v_offer
  FROM public.freight_offers
  WHERE id = _offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada';
  END IF;

  v_is_staff := public.is_staff(v_actor);
  IF NOT v_is_staff AND v_offer.driver_id <> v_actor THEN
    RAISE EXCEPTION 'Sem permissão para negociar esta oferta';
  END IF;

  IF v_offer.status NOT IN ('pending', 'negotiating') THEN
    RAISE EXCEPTION 'Esta oferta não aceita novas contrapropostas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.negotiations n
    WHERE n.offer_id = _offer_id
      AND n.status = 'proposed'
      AND n.proposed_by = v_actor
  ) THEN
    RAISE EXCEPTION 'Aguarde a resposta da outra parte antes de enviar outra proposta';
  END IF;

  UPDATE public.negotiations
  SET status = 'countered'
  WHERE offer_id = _offer_id
    AND status = 'proposed';

  INSERT INTO public.negotiations (offer_id, proposed_by, amount, note, status)
  VALUES (_offer_id, v_actor, _amount, NULLIF(btrim(_note), ''), 'proposed')
  RETURNING id INTO v_negotiation_id;

  UPDATE public.freight_offers
  SET status = 'negotiating'
  WHERE id = _offer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'negotiation_id', v_negotiation_id,
    'offer_id', _offer_id,
    'amount', _amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_freight_counteroffer(
  _negotiation_id uuid,
  _decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_negotiation public.negotiations%ROWTYPE;
  v_offer public.freight_offers%ROWTYPE;
  v_is_staff boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF _decision NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Resposta inválida';
  END IF;

  SELECT * INTO v_negotiation
  FROM public.negotiations
  WHERE id = _negotiation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contraproposta não encontrada';
  END IF;

  SELECT * INTO v_offer
  FROM public.freight_offers
  WHERE id = v_negotiation.offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada';
  END IF;

  v_is_staff := public.is_staff(v_actor);
  IF NOT v_is_staff AND v_offer.driver_id <> v_actor THEN
    RAISE EXCEPTION 'Sem permissão para responder esta contraproposta';
  END IF;

  IF v_negotiation.proposed_by = v_actor THEN
    RAISE EXCEPTION 'A própria proposta não pode ser respondida pelo remetente';
  END IF;

  IF v_negotiation.status <> 'proposed' THEN
    RAISE EXCEPTION 'Esta contraproposta já foi respondida';
  END IF;

  UPDATE public.negotiations
  SET status = _decision::public.negotiation_status
  WHERE id = _negotiation_id;

  IF _decision = 'accepted' THEN
    UPDATE public.negotiations
    SET status = 'countered'
    WHERE offer_id = v_offer.id
      AND status = 'proposed'
      AND id <> _negotiation_id;

    UPDATE public.freight_offers
    SET offered_price = v_negotiation.amount,
        status = 'accepted',
        accepted_at = now()
    WHERE id = v_offer.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'decision', _decision,
    'offer_id', v_offer.id,
    'amount', v_negotiation.amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_freight_counteroffer(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_freight_counteroffer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_freight_counteroffer(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_freight_counteroffer(uuid, text) TO authenticated;