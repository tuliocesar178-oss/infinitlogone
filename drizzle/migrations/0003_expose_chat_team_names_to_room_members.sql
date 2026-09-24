CREATE OR REPLACE FUNCTION public.get_chat_room_team_members(_room_ids uuid[])
RETURNS TABLE (
  room_id uuid,
  full_name text,
  avatar_url text,
  latest_message_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.room_id, m.sender_id)
    m.room_id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Equipe de Operação') AS full_name,
    p.avatar_url,
    m.created_at AS latest_message_at
  FROM public.messages m
  JOIN public.chat_rooms r ON r.id = m.room_id
  JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.room_id = ANY(_room_ids)
    AND m.sender_id <> auth.uid()
    AND public.is_staff(m.sender_id)
    AND (
      public.is_staff(auth.uid())
      OR r.driver_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = r.order_id
          AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
      )
    )
  ORDER BY m.room_id, m.sender_id, m.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_chat_room_team_members(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_room_team_members(uuid[]) TO authenticated, service_role;