-- Enum for message types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_kind') THEN
        CREATE TYPE public.message_kind AS ENUM ('text', 'image', 'video', 'document', 'location', 'audio', 'system', 'occurrence');
    END IF;
END $$;

-- Enum for call status
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

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE, -- Keep for legacy/direct link
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kind public.message_kind DEFAULT 'text',
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store URLs, location coordinates, etc.
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Voice Calls table (masqueraded)
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

-- RLS for chat_rooms
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rooms for their orders" ON public.chat_rooms
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'financeiro') OR
        public.has_role(auth.uid(), 'logistica') OR
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = chat_rooms.order_id 
            AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
        )
    );

-- RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their rooms" ON public.messages
    FOR SELECT TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'financeiro') OR
        public.has_role(auth.uid(), 'logistica') OR
        EXISTS (
            SELECT 1 FROM public.chat_rooms r 
            JOIN public.orders o ON o.id = r.order_id
            WHERE r.id = messages.room_id 
            AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert messages in their rooms" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'logistica') OR
        EXISTS (
            SELECT 1 FROM public.chat_rooms r 
            JOIN public.orders o ON o.id = r.order_id
            WHERE r.id = messages.room_id 
            AND (o.driver_id = auth.uid() OR o.client_id = auth.uid())
        )
    );

-- RLS for voice_calls
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their calls" ON public.voice_calls
    FOR SELECT TO authenticated
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id OR public.has_role(auth.uid(), 'admin'));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.chat_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.voice_calls TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.voice_calls TO service_role;

-- Function to update last_message_at
CREATE OR REPLACE FUNCTION public.update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_rooms 
    SET last_message_at = NEW.created_at
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_update_room_last_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_room_last_message();

-- Auto-create room when order is created
CREATE OR REPLACE FUNCTION public.on_order_created_create_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.chat_rooms (order_id)
    VALUES (NEW.id)
    ON CONFLICT (order_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_on_order_created_chat
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_created_create_chat();

-- Backfill existing orders
INSERT INTO public.chat_rooms (order_id)
SELECT id FROM public.orders
ON CONFLICT (order_id) DO NOTHING;
