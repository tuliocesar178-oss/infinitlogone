-- Direct (non-order) chat rooms with drivers
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_direct_driver_uniq
  ON public.chat_rooms (driver_id) WHERE order_id IS NULL AND driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_rooms_driver_idx ON public.chat_rooms (driver_id);

-- Access helper for direct rooms
CREATE OR REPLACE FUNCTION public.can_access_direct_room(_room_id uuid, _user uuid)
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
      AND r.driver_id IS NOT NULL
      AND (
        public.has_role(_user, 'admin'::app_role)
        OR public.has_role(_user, 'logistics'::app_role)
        OR r.driver_id = _user
      )
  )
$$;

DROP POLICY IF EXISTS "Direct rooms read" ON public.chat_rooms;
CREATE POLICY "Direct rooms read" ON public.chat_rooms
FOR SELECT TO authenticated
USING (
  order_id IS NULL AND driver_id IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'logistics'::app_role)
    OR driver_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Direct rooms update" ON public.chat_rooms;
CREATE POLICY "Direct rooms update" ON public.chat_rooms
FOR UPDATE TO authenticated
USING (public.can_access_direct_room(id, auth.uid()))
WITH CHECK (public.can_access_direct_room(id, auth.uid()));

DROP POLICY IF EXISTS "Direct room messages read" ON public.messages;
CREATE POLICY "Direct room messages read" ON public.messages
FOR SELECT TO authenticated
USING (order_id IS NULL AND public.can_access_direct_room(room_id, auth.uid()));

DROP POLICY IF EXISTS "Direct room messages send" ON public.messages;
CREATE POLICY "Direct room messages send" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND order_id IS NULL
  AND public.can_access_direct_room(room_id, auth.uid())
);

DROP POLICY IF EXISTS "Direct room messages update read state" ON public.messages;
CREATE POLICY "Direct room messages update read state" ON public.messages
FOR UPDATE TO authenticated
USING (order_id IS NULL AND public.can_access_direct_room(room_id, auth.uid()))
WITH CHECK (order_id IS NULL AND public.can_access_direct_room(room_id, auth.uid()));

-- Get or create the single direct room with a driver
CREATE OR REPLACE FUNCTION public.get_or_create_driver_room(_driver_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'logistics'::app_role)
    OR _driver_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para abrir esta conversa';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = _driver_id AND d.approval_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Motorista não está aprovado para conversas';
  END IF;

  SELECT id INTO v_room FROM public.chat_rooms
  WHERE order_id IS NULL AND driver_id = _driver_id
  LIMIT 1;

  IF v_room IS NULL THEN
    INSERT INTO public.chat_rooms (driver_id, last_message_at)
    VALUES (_driver_id, now())
    RETURNING id INTO v_room;
  END IF;

  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_driver_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_direct_room(uuid, uuid) TO authenticated;