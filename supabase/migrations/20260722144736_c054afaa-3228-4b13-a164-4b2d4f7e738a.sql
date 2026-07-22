
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin','logistics','driver','client');
CREATE TYPE public.driver_status AS ENUM ('offline','available','on_trip');
CREATE TYPE public.order_status AS ENUM (
  'created','preparing','driver_assigned','in_transit_to_pickup',
  'picked_up','out_for_delivery','near_destination','delivered','cancelled','incident'
);
CREATE TYPE public.offer_status AS ENUM ('pending','accepted','declined','expired','cancelled','negotiating');
CREATE TYPE public.message_kind AS ENUM ('text','photo','video','pdf','audio');
CREATE TYPE public.negotiation_status AS ENUM ('proposed','accepted','declined','countered');

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- USER ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','logistics')
  );
$$;

-- Policies for user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Policies for profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Staff read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- HANDLE NEW USER TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  -- Default role: client (safe fallback). Admin can promote later.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- VEHICLES
-- =========================================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL UNIQUE,
  model TEXT,
  brand TEXT,
  year INT,
  capacity_kg NUMERIC,
  vehicle_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Drivers read vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'driver'));

-- =========================================================================
-- DRIVERS
-- =========================================================================
CREATE TABLE public.drivers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  license_number TEXT,
  license_category TEXT,
  status public.driver_status NOT NULL DEFAULT 'offline',
  current_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver reads own" ON public.drivers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Driver updates own" ON public.drivers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Staff read drivers" ON public.drivers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage drivers" ON public.drivers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- CLIENTS
-- =========================================================================
CREATE TABLE public.clients (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  document TEXT, -- CPF/CNPJ
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client reads own" ON public.clients FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Client updates own" ON public.clients FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Staff manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- ORDERS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE code TEXT;
BEGIN
  code := 'IL' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  RETURN code;
END;$$;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT ('PED-' || upper(substr(md5(random()::text),1,8))),
  tracking_code TEXT NOT NULL UNIQUE DEFAULT public.generate_tracking_code(),
  invoice_number TEXT,
  client_id UUID REFERENCES public.clients(user_id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(user_id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,

  origin_address TEXT NOT NULL,
  origin_city TEXT,
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,

  destination_address TEXT NOT NULL,
  destination_city TEXT,
  destination_lat DOUBLE PRECISION,
  destination_lng DOUBLE PRECISION,

  cargo_description TEXT,
  cargo_weight_kg NUMERIC,
  cargo_value NUMERIC,

  price NUMERIC,
  distance_km NUMERIC,
  estimated_minutes INT,
  scheduled_at TIMESTAMPTZ,

  status public.order_status NOT NULL DEFAULT 'created',
  invoice_url TEXT,
  notes TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX orders_tracking_code_idx ON public.orders(tracking_code);
CREATE INDEX orders_client_idx ON public.orders(client_id);
CREATE INDEX orders_driver_idx ON public.orders(driver_id);
CREATE INDEX orders_status_idx ON public.orders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
-- Anon needs SELECT for public tracking (filtered by tracking_code policy).
GRANT SELECT ON public.orders TO anon;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read all orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Client reads own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = client_id);
CREATE POLICY "Driver reads assigned orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "Driver updates assigned order status" ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id);
-- Public tracking: allow anyone (anon+auth) to fetch by tracking_code from server-side queries.
-- Since PostgREST cannot restrict columns by policy, we expose a public view instead.

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================================
-- PUBLIC TRACKING VIEW (safe columns only)
-- =========================================================================
CREATE OR REPLACE VIEW public.order_tracking AS
  SELECT
    tracking_code, code, status,
    origin_city, destination_city,
    distance_km, estimated_minutes, scheduled_at,
    driver_id, updated_at, created_at
  FROM public.orders
  WHERE deleted_at IS NULL;
GRANT SELECT ON public.order_tracking TO anon, authenticated;

-- =========================================================================
-- ORDER EVENTS (timeline + audit)
-- =========================================================================
CREATE TABLE public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status public.order_status,
  to_status public.order_status,
  payload JSONB,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON public.order_events(order_id);
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT SELECT ON public.order_events TO anon;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read all events" ON public.order_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert events" ON public.order_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()
  ));
CREATE POLICY "Client reads events of own orders" ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.client_id = auth.uid()));
CREATE POLICY "Driver reads events of assigned orders" ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));

-- =========================================================================
-- FREIGHT OFFERS
-- =========================================================================
CREATE TABLE public.freight_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(user_id) ON DELETE CASCADE,
  offered_price NUMERIC NOT NULL,
  status public.offer_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_lat DOUBLE PRECISION,
  accepted_lng DOUBLE PRECISION,
  time_to_accept_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, driver_id)
);
CREATE INDEX offers_driver_idx ON public.freight_offers(driver_id, status);
CREATE INDEX offers_order_idx ON public.freight_offers(order_id, status);
GRANT SELECT, INSERT, UPDATE ON public.freight_offers TO authenticated;
GRANT ALL ON public.freight_offers TO service_role;
ALTER TABLE public.freight_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver reads own offers" ON public.freight_offers FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "Driver updates own offer" ON public.freight_offers FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "Staff manage offers" ON public.freight_offers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- NEGOTIATIONS
-- =========================================================================
CREATE TABLE public.negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.freight_offers(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  note TEXT,
  status public.negotiation_status NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.negotiations TO authenticated;
GRANT ALL ON public.negotiations TO service_role;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage negotiations" ON public.negotiations FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Driver reads own negotiations" ON public.negotiations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.freight_offers o WHERE o.id = offer_id AND o.driver_id = auth.uid()));
CREATE POLICY "Driver posts negotiation" ON public.negotiations FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.freight_offers o WHERE o.id = offer_id AND o.driver_id = auth.uid()
  ));

-- =========================================================================
-- DELIVERIES (proofs)
-- =========================================================================
CREATE TABLE public.deliveries (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  pickup_photo_url TEXT,
  delivery_photo_url TEXT,
  signature_url TEXT,
  invoice_url TEXT,
  receiver_name TEXT,
  receiver_document TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT SELECT ON public.deliveries TO anon;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage deliveries" ON public.deliveries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Driver upserts own delivery" ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));
CREATE POLICY "Driver updates own delivery" ON public.deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));
CREATE POLICY "Client reads own delivery" ON public.deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.client_id = auth.uid()));
CREATE POLICY "Driver reads own delivery" ON public.deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));

-- =========================================================================
-- MESSAGES (chat per order)
-- =========================================================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.message_kind NOT NULL DEFAULT 'text',
  content TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_order_idx ON public.messages(order_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_order_chat(_order_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_user_id) OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = _order_id
    AND (o.driver_id = _user_id OR o.client_id = _user_id)
  );
$$;

CREATE POLICY "Chat members read" ON public.messages FOR SELECT TO authenticated
  USING (public.can_access_order_chat(order_id, auth.uid()));
CREATE POLICY "Chat members send" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_order_chat(order_id, auth.uid()));

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "User updates own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Staff insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- INCIDENTS
-- =========================================================================
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT,
  severity TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage incidents" ON public.incidents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Driver reports incident on own order" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));
CREATE POLICY "Driver reads incidents of own orders" ON public.incidents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));

-- =========================================================================
-- REALTIME
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
