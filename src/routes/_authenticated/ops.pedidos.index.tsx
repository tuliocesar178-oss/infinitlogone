import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ArrowRight, Plus, Search, Trash2, Truck, MessageSquare } from "lucide-react";
import { DASHBOARD_CARDS, STATUS_LABEL, type DashboardCardKey } from "@/lib/order-status";
import { toast } from "sonner";

const searchSchema = z.object({
  card: z.string().optional(),
  q: z.string().optional(),
  priority: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/ops/pedidos/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Fretes — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: OrdersList,
});

type OrderRow = {
  id: string;
  code: string;
  tracking_code: string;
  status: string;
  client_name: string | null;
  origin_city: string | null;
  destination_city: string | null;
  priority: string | null;
  created_at: string;
};

function OrdersList() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState(search.q ?? "");

  const activeCard = (search.card ?? "") as DashboardCardKey | "";
  const cardDef = DASHBOARD_CARDS.find((c) => c.key === activeCard);

  const { data: orders } = useQuery({
    queryKey: ["orders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, tracking_code, status, client_name, origin_city, destination_city, priority, created_at",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const { data: pendingOfferIds } = useQuery({
    queryKey: ["orders-list-pending-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("freight_offers")
        .select("order_id")
        .eq("status", "pending");
      return new Set((data ?? []).map((o) => o.order_id as string));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("orders-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["orders-list"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_offers" }, () => {
        qc.invalidateQueries({ queryKey: ["orders-list-pending-offers"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    const list = orders ?? [];
    const offers = pendingOfferIds ?? new Set<string>();
    const term = (search.q ?? "").trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return list.filter((o) => {
      if (cardDef) {
        if (!cardDef.statuses.includes(o.status)) return false;
        if (cardDef.key === "awaiting_driver" && offers.has(o.id)) return false;
        if (cardDef.key === "offer_sent" && !offers.has(o.id)) return false;
        if (cardDef.key === "delivered_today" && o.created_at?.slice(0, 10) !== today) return false;
      }
      if (search.priority && o.priority !== search.priority) return false;
      if (term) {
        const hay = `${o.code} ${o.tracking_code} ${o.client_name ?? ""} ${o.origin_city ?? ""} ${o.destination_city ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [orders, pendingOfferIds, cardDef, search.q, search.priority]);

  function applyFilter(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({ search: { ...search, ...patch }, replace: true });
  }

  return (
    <AppShell
      title={cardDef ? cardDef.label : "Todos os fretes"}
      subtitle={cardDef ? `Filtrado por ${cardDef.short.toLowerCase()}` : "Lista completa de fretes ativos"}
      actions={
        <Link
          to="/ops/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo frete
        </Link>
      }
    >
      {/* Card chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => applyFilter({ card: undefined })}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
            !activeCard
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border bg-background hover:bg-accent"
          }`}
        >
          Todos
        </button>
        {DASHBOARD_CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => applyFilter({ card: c.key })}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
              activeCard === c.key
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-background hover:bg-accent"
            }`}
          >
            {c.short}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card-soft mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter({ q: q || undefined })}
            placeholder="Buscar por código, cliente, cidade…"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <select
          value={search.priority ?? ""}
          onChange={(e) => applyFilter({ priority: e.target.value || undefined })}
          className="h-11 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
        >
          <option value="">Todas prioridades</option>
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
        <button
          onClick={() => applyFilter({ q: q || undefined })}
          className="h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          Buscar
        </button>
      </div>

      {/* List */}
      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 border-b border-border/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Código</span>
          <span>Cliente / Rota</span>
          <span className="hidden sm:inline">Status</span>
          <span className="w-8"></span>
          <span className="w-8"></span>
          <span className="w-8"></span>
        </div>
        {filtered.length === 0 && (
          <div className="grid place-items-center p-14 text-center">
            <Truck className="h-8 w-8 text-brand" />
            <div className="mt-3 text-sm font-medium">Nenhum frete encontrado</div>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Ajuste os filtros ou cadastre um novo frete.
            </p>
          </div>
        )}
        {filtered.map((o) => (
          <div
            key={o.id}
            className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border/40 px-5 py-4 last:border-0 hover:bg-surface-2"
          >
            <Link
              to="/ops/pedidos/$id"
              params={{ id: o.id }}
              className="contents"
            >
              <div>
                <div className="font-mono text-sm font-semibold">{o.code}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{o.tracking_code}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{o.client_name ?? "—"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                  {o.priority && o.priority !== "normal" && (
                    <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand">
                      {o.priority}
                    </span>
                  )}
                </div>
              </div>
              <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground sm:inline-block">
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
            </Link>
            
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm(`Deseja realmente excluir o frete ${o.code}? Esta ação não pode ser desfeita.`)) {
                  try {
                    const { error } = await supabase
                      .from("orders")
                      .update({ deleted_at: new Date().toISOString() })
                      .eq("id", o.id);
                    if (error) throw error;
                    toast.success("Frete excluído com sucesso.");
                    qc.invalidateQueries({ queryKey: ["orders-list"] });
                  } catch (err) {
                    toast.error("Erro ao excluir frete.");
                  }
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
              title="Excluir frete"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <Link
              to="/ops/pedidos/$id"
              params={{ id: o.id }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-brand/10 hover:text-brand transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
