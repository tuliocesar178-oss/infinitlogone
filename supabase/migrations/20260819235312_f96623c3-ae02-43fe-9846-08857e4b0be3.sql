-- Full Migration to unify everything
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_kind') THEN
        CREATE TYPE public.message_kind AS ENUM ('text', 'image', 'video', 'document', 'location', 'audio', 'system', 'occurrence');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
        CREATE TYPE public.call_status AS ENUM ('dialing', 'ringing', 'connected', 'ended', 'missed', 'rejected');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id)
);

-- Prepare messages table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='room_id') THEN
        ALTER TABLE public.messages ADD COLUMN room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='metadata') THEN
        ALTER TABLE public.messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='read_at') THEN
        ALTER TABLE public.messages ADD COLUMN read_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='deleted_at') THEN
        ALTER TABLE public.messages ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.voice_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    caller_id UUID REFERENCES auth.users(id),
    receiver_id UUID REFERENCES auth.users(id),
    status public.call_status DEFAULT 'dialing',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS and Grants
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.chat_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.voice_calls TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.voice_calls TO service_role;

DROP POLICY IF EXISTS "Users can view rooms for their orders" ON public.chat_rooms;
CREATE POLICY "Users can view rooms for their orders" ON public.chat_rooms
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'financeiro') OR
        public.has_role(auth.uid(), 'logistics') OR
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = chat_rooms.order_id 
            AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
CREATE POLICY "Users can view messages in their rooms" ON public.messages
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'financeiro') OR
        public.has_role(auth.uid(), 'logistics') OR
        EXISTS (
            SELECT 1 FROM public.chat_rooms r 
            JOIN public.orders o ON o.id = r.order_id
            WHERE r.id = messages.room_id 
            AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can insert messages in their rooms" ON public.messages;
CREATE POLICY "Users can insert messages in their rooms" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'logistics') OR
        EXISTS (
            SELECT 1 FROM public.chat_rooms r 
            JOIN public.orders o ON o.id = r.order_id
            WHERE r.id = messages.room_id 
            AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can view their calls" ON public.voice_calls;
CREATE POLICY "Users can view their calls" ON public.voice_calls
    FOR SELECT TO authenticated
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id OR public.has_role(auth.uid(), 'admin'));

-- Triggers
CREATE OR REPLACE FUNCTION public.update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_rooms 
    SET last_message_at = NEW.created_at
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_room_last_message ON public.messages;
CREATE TRIGGER tr_update_room_last_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_room_last_message();

CREATE OR REPLACE FUNCTION public.on_order_created_create_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.chat_rooms (order_id)
    VALUES (NEW.id)
    ON CONFLICT (order_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_order_created_chat ON public.orders;
CREATE TRIGGER tr_on_order_created_chat
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_created_create_chat();

-- Backfill
INSERT INTO public.chat_rooms (order_id)
SELECT id FROM public.orders
ON CONFLICT (order_id) DO NOTHING;

UPDATE public.messages m
SET room_id = r.id
FROM public.chat_rooms r
WHERE m.order_id = r.order_id AND m.room_id IS NULL;