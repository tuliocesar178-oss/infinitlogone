import { useEffect, useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOperationBoard } from "@/lib/operation-board.functions";
import { supabase } from "@/integrations/supabase/client";

export const operationalTrackingQuery = queryOptions({ queryKey: ["operation-board"], queryFn: () => getOperationBoard(), staleTime: 10_000, refetchInterval: 60_000, retry: 2 });
export function useOperationalTracking(subscribe = true) {
  const query = useQuery(operationalTrackingQuery);
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!subscribe) return;
    setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    let pending: number | undefined;
    let disposed = false;
    const invalidate = () => {
      if (pending) return;
      pending = window.setTimeout(() => { pending = undefined; if (!disposed) void qc.invalidateQueries({ queryKey: ["operation-board"] }); }, 500);
    };
    let channel = supabase.channel(`operational-tracking-${crypto.randomUUID()}`);
    for (const table of ["orders", "drivers", "vehicles", "incidents", "order_events", "driver_locations", "app_settings"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidate);
    }
    channel = channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "order_tracking_points" },
      (payload) => {
        const point = payload.new as {
          order_id: string;
          lat: number;
          lng: number;
          speed: number | null;
          heading: number | null;
          accuracy: number | null;
          created_at: string;
        };
        if (
          !point.order_id ||
          !Number.isFinite(point.lat) ||
          !Number.isFinite(point.lng)
        ) return;
        qc.setQueryData<{ orders: import("@/lib/operation-board").BoardOrder[] }>(
          ["operation-board"],
          (current) => current
            ? {
                ...current,
                orders: current.orders.map((order) =>
                  order.id === point.order_id
                    ? {
                        ...order,
                        current_lat: point.lat,
                        current_lng: point.lng,
                        last_ping_at: point.created_at,
                        tracking_heading: point.heading,
                        tracking_speed_kmh: point.speed,
                        tracking_accuracy: point.accuracy,
                      }
                    : order,
                ),
              }
            : current,
        );
      },
    );
    channel.subscribe((status) => {
      setConnected(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") void qc.invalidateQueries({ queryKey: ["operation-board"] });
    });
    const offline = () => setConnected(false);
    const online = () => { setConnected(false); invalidate(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { disposed = true; clearInterval(clock); if (pending) clearTimeout(pending); window.removeEventListener("offline", offline); window.removeEventListener("online", online); void supabase.removeChannel(channel); };
  }, [qc, subscribe]);
  return { query, connected, now };
}