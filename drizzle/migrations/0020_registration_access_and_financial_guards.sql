REVOKE SELECT ON public.drivers FROM authenticated,anon;
REVOKE SELECT(pix_key,pix_key_type,bank_name,bank_code,bank_agency,bank_account,bank_account_digit,bank_account_type,favored_name,favored_document,financial_notes) ON public.drivers FROM authenticated,anon;
GRANT SELECT(user_id,full_name,phone_verified,updated_at,deleted_at,license_number,license_category,status,current_vehicle_id,current_lat,current_lng,last_seen_at,created_at,cpf,phone,city,photo_url,rntrc,cnh_expires_at,preferred_payment_method,payment_term_days,default_price_per_km,min_freight_value,financial_status,rg,cnh_issued_at,antt_expires_at,whatsapp,email,birth_date,gender,civil_status,address,address_number,address_complement,neighborhood,state,zip,notes,availability,rating,daily_rate,hourly_wait_rate,owns_vehicle,approval_status,rejection_reason,correction_notes,submitted_at,reviewed_at,reviewed_by,current_speed,current_heading,current_accuracy,current_altitude) ON public.drivers TO authenticated;
ALTER TABLE public.operational_identities ADD COLUMN activation_claim uuid, ADD COLUMN activation_started_at timestamptz;
CREATE FUNCTION public.claim_registration_activation(_id uuid,_claim uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.operational_identities SET activation_claim=_claim,activation_started_at=now() WHERE id=_id AND auth_user_id IS NULL AND activation_claim IS NULL;RETURN FOUND; END $$;
CREATE FUNCTION public.complete_registration_activation(_id uuid,_claim uuid,_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM 1 FROM public.operational_identities WHERE id=_id AND activation_claim=_claim AND auth_user_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ativação já utilizada ou sem autorização'; END IF;
 IF _kind='driver' AND NOT EXISTS(SELECT 1 FROM public.drivers WHERE user_id=_id) THEN RAISE EXCEPTION 'Motorista não encontrado'; END IF;
 IF _kind='client' AND NOT EXISTS(SELECT 1 FROM public.clients WHERE user_id=_id) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
 IF _kind NOT IN ('driver','client') THEN RAISE EXCEPTION 'Perfil inválido'; END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES(_id,_kind::public.app_role) ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.operational_identities SET auth_user_id=_id,activation_claim=NULL,activation_started_at=NULL,updated_at=now() WHERE id=_id;
 END $$;
REVOKE ALL ON FUNCTION public.claim_registration_activation(uuid,uuid),public.complete_registration_activation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_activation(uuid,uuid),public.complete_registration_activation(uuid,uuid,text) TO service_role;