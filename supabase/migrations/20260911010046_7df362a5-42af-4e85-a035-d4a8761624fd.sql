
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS staff_a uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS staff_b uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_staff_pair_uidx
  ON public.chat_rooms (staff_a, staff_b)
  WHERE order_id IS NULL AND staff_a IS NOT NULL AND staff_b IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_access_staff_room(_room_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms r
    WHERE r.id = _room_id
      AND r.order_id IS NULL
      AND r.staff_a IS NOT NULL
      AND (r.staff_a = _user OR r.staff_b = _user)
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_staff_room(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_staff_room(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Staff room read" ON public.chat_rooms;
CREATE POLICY "Staff room read" ON public.chat_rooms
FOR SELECT TO authenticated
USING (staff_a = auth.uid() OR staff_b = auth.uid());

DROP POLICY IF EXISTS "Staff room messages read" ON public.messages;
CREATE POLICY "Staff room messages read" ON public.messages
FOR SELECT TO authenticated
USING (order_id IS NULL AND public.can_access_staff_room(room_id, auth.uid()));

DROP POLICY IF EXISTS "Staff room messages send" ON public.messages;
CREATE POLICY "Staff room messages send" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND order_id IS NULL
  AND public.can_access_staff_room(room_id, auth.uid())
);

DROP POLICY IF EXISTS "Staff room messages update" ON public.messages;
CREATE POLICY "Staff room messages update" ON public.messages
FOR UPDATE TO authenticated
USING (order_id IS NULL AND public.can_access_staff_room(room_id, auth.uid()))
WITH CHECK (order_id IS NULL AND public.can_access_staff_room(room_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_or_create_staff_room(_other_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _room uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF _other_id = _me THEN
    RAISE EXCEPTION 'Não é possível conversar consigo mesmo';
  END IF;
  IF NOT public.is_staff(_me) OR NOT public.is_staff(_other_id) THEN
    RAISE EXCEPTION 'Conversa interna disponível apenas para a equipe';
  END IF;

  _a := LEAST(_me::text, _other_id::text)::uuid;
  _b := GREATEST(_me::text, _other_id::text)::uuid;

  SELECT id INTO _room FROM public.chat_rooms
   WHERE order_id IS NULL AND staff_a = _a AND staff_b = _b
   LIMIT 1;

  IF _room IS NULL THEN
    INSERT INTO public.chat_rooms (staff_a, staff_b, last_message_at)
    VALUES (_a, _b, now())
    RETURNING id INTO _room;
  END IF;

  RETURN _room;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_staff_room(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_staff_room(uuid) TO authenticated;
