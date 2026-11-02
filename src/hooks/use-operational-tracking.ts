import { useEffect, useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOperationBoard } from "@/lib/operation-board.functions";
import { supabase } from "@/integrations/supabase/client";

export const operationalTrackingQuery = queryOptions({ queryKey: ["operation-board"], queryFn: () => getOperationBoard(), staleTime: 10_000, refetchInterval: 15_000, retry: 2 });
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
    for (const table of ["orders", "drivers", "vehicles", "incidents", "order_events", "order_tracking_points", "driver_locations", "app_settings"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidate);
    }
    channel.subscribe(status => setConnected(status === "SUBSCRIBED"));
    const offline = () => setConnected(false);
    const online = () => { setConnected(false); invalidate(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => { disposed = true; clearInterval(clock); if (pending) clearTimeout(pending); window.removeEventListener("offline", offline); window.removeEventListener("online", online); void supabase.removeChannel(channel); };
  }, [qc, subscribe]);
  return { query, connected, now };
}