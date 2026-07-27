import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/order-status";
import { brl } from "@/lib/pf";
import { MapPin, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/fretes")({
  head: () => ({ meta: [{ title: "Minhas rotas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverFreights,
});

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Em andamento" },
  { key: "done", label: "Concluídos" },
] as const;

function DriverFreights() {
  const [userId, setUserId] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-freights", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, tracking_code, status, origin_city, destination_city, price, created_at, updated_at")
        .eq("driver_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const items = useMemo(() => {
    const all = q.data ?? [];
    if (filter === "active") return all.filter((o) => !["delivered","finalized","cancelled"].includes(o.status));
    if (filter === "done") return all.filter((o) => ["delivered","finalized"].includes(o.status));
    return all;
  }, [q.data, filter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minhas rotas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Histórico completo dos fretes atribuídos a você.</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              filter === f.key ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Truck className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum frete encontrado.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li key={o.id} className="card-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">{o.code}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{brl(o.price)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(o.updated_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span className={STATUS_BADGE_CLASS[o.status] ?? "inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs"}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
