ALTER TABLE public.chat_rooms ADD COLUMN participant_a uuid, ADD COLUMN participant_b uuid, ADD COLUMN merged_into_room_id uuid REFERENCES public.chat_rooms(id), ADD COLUMN is_operation boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX chat_rooms_participant_pair_unique ON public.chat_rooms(participant_a, participant_b) WHERE participant_a IS NOT NULL AND participant_b IS NOT NULL;
CREATE UNIQUE INDEX chat_rooms_single_operation ON public.chat_rooms(is_operation) WHERE is_operation;
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_pair_order CHECK ((participant_a IS NULL AND participant_b IS NULL) OR (participant_a IS NOT NULL AND participant_b IS NOT NULL AND participant_a < participant_b));
CREATE INDEX messages_freight_context_idx ON public.messages(order_id, created_at);
CREATE INDEX chat_rooms_merge_idx ON public.chat_rooms(merged_into_room_id);
COMMENT ON COLUMN public.chat_rooms.driver_id IS 'DEPRECATED: legacy shared driver history; individual identity uses participant_a and participant_b';
COMMENT ON COLUMN public.chat_rooms.staff_a IS 'DEPRECATED: legacy pair retained for compatibility; individual identity uses participant_a and participant_b';
COMMENT ON COLUMN public.chat_rooms.staff_b IS 'DEPRECATED: legacy pair retained for compatibility; individual identity uses participant_a and participant_b';
UPDATE public.chat_rooms SET participant_a = LEAST(staff_a,staff_b), participant_b = GREATEST(staff_a,staff_b) WHERE staff_a IS NOT NULL AND staff_b IS NOT NULL;
DO $$ DECLARE r record; target uuid; BEGIN
 FOR r IN SELECT cr.id, min(m.sender_id::text)::uuid a, max(m.sender_id::text)::uuid b FROM public.chat_rooms cr JOIN public.messages m ON m.room_id=cr.id WHERE cr.participant_a IS NULL GROUP BY cr.id HAVING count(DISTINCT m.sender_id)=2 LOOP
  IF (public.is_staff(r.a) AND (public.is_staff(r.b) OR EXISTS(SELECT 1 FROM public.drivers WHERE user_id=r.b))) OR (public.is_staff(r.b) AND EXISTS(SELECT 1 FROM public.drivers WHERE user_id=r.a)) THEN
   INSERT INTO public.chat_rooms(participant_a,participant_b,last_message_at) VALUES(r.a,r.b,now()) ON CONFLICT(participant_a,participant_b) WHERE participant_a IS NOT NULL AND participant_b IS NOT NULL DO UPDATE SET participant_a=EXCLUDED.participant_a RETURNING id INTO target;
   UPDATE public.chat_rooms SET merged_into_room_id=target WHERE id=r.id;
  END IF;
 END LOOP;
END $$;
CREATE TABLE public.chat_read_receipts (room_id uuid NOT NULL REFERENCES public.chat_rooms(id), user_id uuid NOT NULL REFERENCES public.profiles(id), last_read_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room_id,user_id));
GRANT SELECT, INSERT, UPDATE ON public.chat_read_receipts TO authenticated;
GRANT ALL ON public.chat_read_receipts TO service_role;
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_access_unified_chat(_room uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user IS NOT NULL AND EXISTS(SELECT 1 FROM public.chat_rooms source JOIN public.chat_rooms r ON r.id=COALESCE(source.merged_into_room_id,source.id) WHERE source.id=_room AND CASE WHEN r.is_operation THEN public.is_staff(_user) WHEN r.participant_a IS NOT NULL THEN _user IN(r.participant_a,r.participant_b) ELSE (CASE WHEN r.order_id IS NOT NULL THEN public.can_access_order_chat(r.order_id,_user) WHEN r.driver_id IS NOT NULL THEN public.is_staff(_user) OR r.driver_id=_user ELSE _user IN(r.staff_a,r.staff_b) END) END);
$$;
CREATE POLICY receipts_own ON public.chat_read_receipts FOR ALL TO authenticated USING(user_id=auth.uid() AND public.can_access_unified_chat(room_id,auth.uid())) WITH CHECK(user_id=auth.uid() AND public.can_access_unified_chat(room_id,auth.uid()));
CREATE POLICY unified_room_select ON public.chat_rooms FOR SELECT TO authenticated USING(public.can_access_unified_chat(id,auth.uid()));
CREATE POLICY unified_room_boundary ON public.chat_rooms AS RESTRICTIVE FOR ALL TO authenticated USING(public.can_access_unified_chat(id,auth.uid())) WITH CHECK(false);
CREATE POLICY unified_messages_select ON public.messages FOR SELECT TO authenticated USING(public.can_access_unified_chat(room_id,auth.uid()));
CREATE POLICY unified_messages_boundary ON public.messages AS RESTRICTIVE FOR ALL TO authenticated USING(public.can_access_unified_chat(room_id,auth.uid())) WITH CHECK(sender_id=auth.uid() AND public.can_access_unified_chat(room_id,auth.uid()) AND EXISTS(SELECT 1 FROM public.chat_rooms r WHERE r.id=room_id AND r.merged_into_room_id IS NULL AND (r.participant_a IS NOT NULL OR r.is_operation)));
CREATE POLICY unified_messages_send ON public.messages FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND public.can_access_unified_chat(room_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.get_or_create_individual_chat(_other uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE me uuid:=auth.uid(); a uuid; b uuid; target uuid; BEGIN
 IF me IS NULL OR _other IS NULL OR me=_other THEN RAISE EXCEPTION 'Participantes inválidos'; END IF;
 IF NOT ((public.is_staff(me) AND public.is_staff(_other)) OR (public.is_staff(me) AND EXISTS(SELECT 1 FROM public.drivers WHERE user_id=_other AND approval_status='active')) OR (public.is_staff(_other) AND EXISTS(SELECT 1 FROM public.drivers WHERE user_id=me AND approval_status='active'))) THEN RAISE EXCEPTION 'Sem permissão para conversar'; END IF;
 a:=LEAST(me,_other); b:=GREATEST(me,_other);
 INSERT INTO public.chat_rooms(participant_a,participant_b,last_message_at) VALUES(a,b,now()) ON CONFLICT(participant_a,participant_b) WHERE participant_a IS NOT NULL AND participant_b IS NOT NULL DO UPDATE SET participant_a=EXCLUDED.participant_a RETURNING id INTO target;
 RETURN target; END $$;
CREATE OR REPLACE FUNCTION public.get_or_create_operation_room() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target uuid; BEGIN IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Grupo exclusivo da equipe'; END IF;
 INSERT INTO public.chat_rooms(is_operation,last_message_at) VALUES(true,now()) ON CONFLICT(is_operation) WHERE is_operation DO UPDATE SET is_operation=true RETURNING id INTO target; RETURN target; END $$;
CREATE OR REPLACE FUNCTION public.get_or_create_driver_room(_driver_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN public.get_or_create_individual_chat(_driver_id); END $$;
CREATE OR REPLACE FUNCTION public.get_or_create_staff_room(_other_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN public.get_or_create_individual_chat(_other_id); END $$;
CREATE OR REPLACE FUNCTION public.get_unified_chat_directory() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH contacts AS (
 SELECT p.id,p.full_name,p.avatar_url,p.phone,CASE WHEN public.is_staff(p.id) THEN 'Equipe de Operação' ELSE 'Motorista' END subtitle FROM public.profiles p WHERE auth.uid() IS NOT NULL AND p.id<>auth.uid() AND ((public.is_staff(auth.uid()) AND (public.is_staff(p.id) OR EXISTS(SELECT 1 FROM public.drivers d WHERE d.user_id=p.id AND d.approval_status='active'))) OR (EXISTS(SELECT 1 FROM public.drivers d WHERE d.user_id=auth.uid() AND d.approval_status='active') AND public.is_staff(p.id)))
 ), items AS (
 SELECT p.id peer_id,r.id room_id,COALESCE(NULLIF(p.full_name,''),'Integrante') title,p.avatar_url,p.phone,p.subtitle,'individual' category,NULL::uuid order_id,
 (SELECT max(m.created_at) FROM public.messages m JOIN public.chat_rooms s ON s.id=m.room_id WHERE COALESCE(s.merged_into_room_id,s.id)=r.id) last_message_at,
 (SELECT count(*) FROM public.messages m JOIN public.chat_rooms s ON s.id=m.room_id WHERE COALESCE(s.merged_into_room_id,s.id)=r.id AND m.sender_id<>auth.uid() AND m.read_at IS NULL AND m.deleted_at IS NULL) unread
 FROM contacts p LEFT JOIN public.chat_rooms r ON r.participant_a=LEAST(auth.uid(),p.id) AND r.participant_b=GREATEST(auth.uid(),p.id)
 UNION ALL
 SELECT NULL,r.id,CASE WHEN r.is_operation THEN 'OPERAÇÃO' ELSE COALESCE(o.code,'Histórico operacional') END,NULL,NULL,CASE WHEN r.is_operation THEN 'Grupo interno da equipe' ELSE 'Histórico operacional' END,CASE WHEN r.is_operation THEN 'group' ELSE 'history' END,r.order_id,r.last_message_at,
 (SELECT count(*) FROM public.messages m WHERE m.room_id=r.id AND m.sender_id<>auth.uid() AND m.deleted_at IS NULL AND CASE WHEN r.is_operation THEN m.created_at>COALESCE((SELECT last_read_at FROM public.chat_read_receipts WHERE room_id=r.id AND user_id=auth.uid()),'-infinity'::timestamptz) ELSE m.read_at IS NULL END)
 FROM public.chat_rooms r LEFT JOIN public.orders o ON o.id=r.order_id WHERE r.participant_a IS NULL AND r.merged_into_room_id IS NULL AND public.can_access_unified_chat(r.id,auth.uid()) AND (r.is_operation OR EXISTS(SELECT 1 FROM public.messages WHERE room_id=r.id))
 ) SELECT COALESCE(jsonb_agg(to_jsonb(items) ORDER BY last_message_at DESC NULLS LAST,title),'[]'::jsonb) FROM items;
$$;
CREATE OR REPLACE FUNCTION public.get_unified_chat_messages(_room uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
 IF NOT public.can_access_unified_chat(_room,auth.uid()) THEN RAISE EXCEPTION 'Sem acesso à conversa'; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(m)||jsonb_build_object('sender',jsonb_build_object('full_name',p.full_name,'avatar_url',p.avatar_url),'order_code',o.code,'order_id',COALESCE(m.order_id,s.order_id)) ORDER BY m.created_at,m.id),'[]'::jsonb) INTO result FROM public.messages m JOIN public.chat_rooms s ON s.id=m.room_id LEFT JOIN public.profiles p ON p.id=m.sender_id LEFT JOIN public.orders o ON o.id=COALESCE(m.order_id,s.order_id) WHERE COALESCE(s.merged_into_room_id,s.id)=(SELECT COALESCE(merged_into_room_id,id) FROM public.chat_rooms WHERE id=_room) AND m.deleted_at IS NULL;
 RETURN result; END $$;
CREATE OR REPLACE FUNCTION public.search_unified_chat(_term text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(DISTINCT COALESCE(r.merged_into_room_id,r.id)),'[]'::jsonb) FROM public.messages m JOIN public.chat_rooms r ON r.id=m.room_id LEFT JOIN public.orders o ON o.id=COALESCE(m.order_id,r.order_id) WHERE auth.uid() IS NOT NULL AND public.can_access_unified_chat(r.id,auth.uid()) AND m.deleted_at IS NULL AND (m.content ILIKE '%'||left(_term,200)||'%' OR o.code ILIKE '%'||left(_term,200)||'%');
$$;
CREATE OR REPLACE FUNCTION public.mark_unified_chat_read(_room uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target uuid; BEGIN IF NOT public.can_access_unified_chat(_room,auth.uid()) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
 SELECT COALESCE(merged_into_room_id,id) INTO target FROM public.chat_rooms WHERE id=_room;
 INSERT INTO public.chat_read_receipts(room_id,user_id,last_read_at) VALUES(target,auth.uid(),now()) ON CONFLICT(room_id,user_id) DO UPDATE SET last_read_at=now(),updated_at=now();
 IF EXISTS(SELECT 1 FROM public.chat_rooms WHERE id=target AND participant_a IS NOT NULL) THEN UPDATE public.messages m SET read_at=COALESCE(read_at,now()) FROM public.chat_rooms s WHERE m.room_id=s.id AND COALESCE(s.merged_into_room_id,s.id)=target AND m.sender_id<>auth.uid() AND m.read_at IS NULL; END IF; END $$;
CREATE OR REPLACE FUNCTION public.send_unified_chat_message(_room uuid,_content text,_order uuid DEFAULT NULL,_kind public.message_kind DEFAULT 'text',_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.chat_rooms%ROWTYPE; o public.orders%ROWTYPE; target uuid; BEGIN
 SELECT * INTO r FROM public.chat_rooms WHERE id=_room;
 IF auth.uid() IS NULL OR NOT public.can_access_unified_chat(_room,auth.uid()) OR r.merged_into_room_id IS NOT NULL OR (r.participant_a IS NULL AND NOT r.is_operation) THEN RAISE EXCEPTION 'Histórico somente para leitura ou acesso negado'; END IF;
 IF _content IS NULL OR length(btrim(_content))=0 OR length(_content)>10000 THEN RAISE EXCEPTION 'Mensagem inválida'; END IF;
 IF _order IS NOT NULL THEN SELECT * INTO o FROM public.orders WHERE id=_order; IF NOT FOUND OR NOT public.can_access_order_chat(_order,auth.uid()) OR (r.participant_a IS NOT NULL AND NOT (public.is_staff(r.participant_a) AND public.is_staff(r.participant_b)) AND NOT (o.driver_id IN(r.participant_a,r.participant_b))) THEN RAISE EXCEPTION 'Referência de frete não autorizada'; END IF; END IF;
 INSERT INTO public.messages(room_id,order_id,sender_id,kind,content,metadata) VALUES(_room,_order,auth.uid(),_kind,btrim(_content),_metadata) RETURNING id INTO target;
 INSERT INTO public.notifications(user_id,type,title,body,data) SELECT p.id,'chat_message','Nova mensagem',left(btrim(_content),160),jsonb_build_object('room_id',_room,'order_id',_order) FROM public.profiles p WHERE p.id<>auth.uid() AND CASE WHEN r.is_operation THEN public.is_staff(p.id) ELSE p.id IN(r.participant_a,r.participant_b) END;
 RETURN target; END $$;
CREATE OR REPLACE FUNCTION public.get_chat_room_team_members(_room_ids uuid[]) RETURNS TABLE(room_id uuid,full_name text,avatar_url text,latest_message_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT DISTINCT ON(m.room_id,m.sender_id) m.room_id,COALESCE(p.full_name,'Equipe de Operação'),p.avatar_url,m.created_at FROM public.messages m JOIN public.profiles p ON p.id=m.sender_id WHERE m.room_id=ANY(_room_ids) AND m.sender_id<>auth.uid() AND public.is_staff(m.sender_id) AND public.can_access_unified_chat(m.room_id,auth.uid()) AND m.deleted_at IS NULL ORDER BY m.room_id,m.sender_id,m.created_at DESC $$;
REVOKE ALL ON FUNCTION public.get_or_create_individual_chat(uuid), public.get_or_create_operation_room(), public.get_unified_chat_directory(),public.get_unified_chat_messages(uuid),public.search_unified_chat(text),public.mark_unified_chat_read(uuid),public.send_unified_chat_message(uuid,text,uuid,public.message_kind,jsonb),public.can_access_unified_chat(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_individual_chat(uuid),public.get_or_create_operation_room(),public.get_unified_chat_directory(),public.get_unified_chat_messages(uuid),public.search_unified_chat(text),public.mark_unified_chat_read(uuid),public.send_unified_chat_message(uuid,text,uuid,public.message_kind,jsonb),public.can_access_unified_chat(uuid,uuid) TO authenticated;
