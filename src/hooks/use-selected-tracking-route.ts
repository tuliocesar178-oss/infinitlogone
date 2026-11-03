import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSelectedTrackingRoute } from "@/lib/tracking-route.functions";
import { hasActiveDriverRoute, trackingStage, type TrackingRouteOrder } from "@/lib/tracking-route-model";

export function useSelectedTrackingRoute(order: TrackingRouteOrder | null | undefined) {
  const fetchRoute = useServerFn(getSelectedTrackingRoute);
  return useQuery({
    // GPS pings do not change the key or issue another Directions request.
    queryKey: ["selected-tracking-route", order?.id, order ? trackingStage(order) : null, order?.driver_id,
      order?.origin_lat, order?.origin_lng, order?.destination_lat, order?.destination_lng, order?.route_geometry],
    queryFn: () => {
      if (!order) throw new Error("Nenhum frete selecionado.");
      return fetchRoute({ data: { orderId: order.id } });
    },
    enabled: Boolean(order && hasActiveDriverRoute(order)),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}