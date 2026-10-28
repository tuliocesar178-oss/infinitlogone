CREATE OR REPLACE FUNCTION public.track_record_completeness()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE pending text[]:='{}'; r jsonb:=to_jsonb(NEW); mode boolean:=public.test_mode_enabled(); BEGIN
 IF TG_TABLE_NAME IN ('drivers','clients') THEN
 IF coalesce(trim(r->>'full_name'),'')='' THEN pending:=array_append(pending,'Nome pendente'); END IF;
 IF coalesce(trim(CASE WHEN TG_TABLE_NAME='drivers' THEN r->>'phone' ELSE r->>'contact_phone' END),'')='' THEN pending:=array_append(pending,'Telefone pendente'); END IF;
 ELSIF TG_TABLE_NAME='vehicles' THEN
 IF coalesce(trim(NEW.plate),'')='' THEN pending:=array_append(pending,'Placa pendente'); END IF; NEW.registration_plate:=nullif(trim(NEW.plate),'');
 ELSIF TG_TABLE_NAME='works' THEN
 IF coalesce(trim(NEW.name),'')='' THEN pending:=array_append(pending,'Nome da obra pendente'); END IF;
 IF coalesce(trim(NEW.address),'')='' OR NEW.latitude IS NULL OR NEW.longitude IS NULL THEN pending:=array_append(pending,'Localização pendente'); END IF;
 ELSIF TG_TABLE_NAME='orders' THEN
 IF coalesce(trim(NEW.client_name),'')='' THEN pending:=array_append(pending,'Cliente pendente'); END IF;
 IF coalesce(trim(NEW.origin_address),'')='' OR coalesce(NEW.origin_location_details->>'precision','unconfirmed') NOT IN ('manual','address') THEN pending:=array_append(pending,'Coleta pendente'); END IF;
 IF coalesce(trim(NEW.destination_address),'')='' OR coalesce(NEW.destination_location_details->>'precision','unconfirmed') NOT IN ('manual','address') THEN pending:=array_append(pending,'Entrega pendente'); END IF;
 IF NEW.origin_lat IS NULL OR NEW.origin_lng IS NULL OR NEW.destination_lat IS NULL OR NEW.destination_lng IS NULL OR NEW.route_geometry IS NULL THEN pending:=array_append(pending,'Rota pendente'); END IF;
 IF NEW.price IS NULL THEN pending:=array_append(pending,'Valor pendente'); END IF;
 IF TG_OP='INSERT' THEN NEW.created_in_test_mode:=mode; ELSE NEW.created_in_test_mode:=OLD.created_in_test_mode; END IF;
 END IF;
 NEW.completeness_pending:=pending;
 IF NOT mode AND TG_OP='INSERT' AND cardinality(pending)>0 THEN RAISE EXCEPTION 'Informações obrigatórias pendentes: %',array_to_string(pending,', '); END IF;
 IF TG_TABLE_NAME='orders' AND TG_OP='UPDATE' THEN
   IF (r->>'status') IS DISTINCT FROM (to_jsonb(OLD)->>'status') AND NOT mode AND (r->>'status') NOT IN ('planning','created','cancelled') AND cardinality(pending)>0 THEN RAISE EXCEPTION 'Complete os dados antes de operar em produção: %',array_to_string(pending,', '); END IF;
 END IF;
 RETURN NEW; END; $function$;