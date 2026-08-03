-- 1) Vehicles: restrict driver read to own/assigned vehicles
DROP POLICY IF EXISTS "Drivers read vehicles" ON public.vehicles;

CREATE POLICY "vehicles driver assigned read"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  owner_driver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid() AND d.current_vehicle_id = vehicles.id
  )
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.vehicle_id = vehicles.id AND o.driver_id = auth.uid()
  )
);

-- 2) Drivers: remove banking/financial columns from client-readable surface
REVOKE SELECT ON public.drivers FROM authenticated;
REVOKE SELECT ON public.drivers FROM anon;

GRANT SELECT (
  user_id, license_number, license_category, status, current_vehicle_id,
  current_lat, current_lng, last_seen_at, created_at, cpf, phone, city,
  photo_url, rntrc, cnh_expires_at, preferred_payment_method, payment_term_days,
  default_price_per_km, min_freight_value, financial_status, rg, cnh_issued_at,
  antt_expires_at, whatsapp, email, birth_date, gender, civil_status, address,
  address_number, address_complement, neighborhood, state, zip, notes,
  availability, rating, daily_rate, hourly_wait_rate, owns_vehicle,
  approval_status, rejection_reason, correction_notes, submitted_at,
  reviewed_at, reviewed_by, current_speed, current_heading, current_accuracy,
  current_altitude
) ON public.drivers TO authenticated;

GRANT ALL ON public.drivers TO service_role;

-- 3) SECURITY DEFINER functions: keep only the RLS-helper predicates callable by clients
REVOKE EXECUTE ON FUNCTION public.get_tracking(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_order_chat(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_route(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.override_arrival(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_driver_signup(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_program_to_driver(uuid, uuid, numeric, integer) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_tracking(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_order_chat(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_route(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.override_arrival(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_driver_signup(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_program_to_driver(uuid, uuid, numeric, integer) TO service_role;