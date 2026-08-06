import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActiveOrderPanel, OfferCard, type Order } from "@/components/driver/panels";
import { Truck, ChevronRight, Package, CircleDollarSign } from "lucide-react";
import { brl } from "@/lib/pf";
import { useBackgroundTracking } from "@/hooks/use-background-tracking";

export const Route = createFileRoute("/_authenticated/driver/")({
  head: () => ({ meta: [{ title: "Início — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverHome,
});

function DriverHome() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      const n = p?.full_name ?? u.user.email ?? "Motorista";
      setFirstName(n.split(" ")[0]);

      // Atualizar status e disponibilidade do motorista ao acessar o dashboard
      await supabase
        .from("drivers")
        .update({ 
          status: 'available' as any, 
          availability: 'disponivel' as any, 
          last_seen_at: new Date().toISOString() 
        })
        .eq("user_id", u.user.id);
      
      // Forçar atualização do dashboard após marcar como disponível
      qc.invalidateQueries({ queryKey: ["driver-offers", u.user.id] });
      qc.invalidateQueries({ queryKey: ["driver-home-stats", u.user.id] });
    })();
  }, []);

  const activeQ = useQuery({
    enabled: !!userId,
    queryKey: ["driver-active", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", userId)
        .not("status", "in", "(delivered,finalized,cancelled)")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data ?? null) as Order | null;
    },
    refetchInterval: 5000,
  });

  const offersQ = useQuery({
    enabled: !!userId,
    queryKey: ["driver-offers", userId],
    queryFn: async () => {
      const { data: offers, error: offErr } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("driver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);
      
      if (offErr) {
        console.error("Erro ao buscar ofertas:", offErr);
        return [];
      }
      if (!offers?.length) return [];
      
      const ids = offers.map((o) => o.order_id);
      const [{ data: orders }, { data: programs }] = await Promise.all([
        supabase.from("orders").select("*").in("id", ids),
        supabase.from("freight_programs").select("*").in("order_id", ids),
      ]);
      
      return offers.map((o) => ({
        offer: o,
        order: orders?.find((x) => x.id === o.order_id),
        program: programs?.find((p) => p.order_id === o.order_id),
      }));
    },
    refetchInterval: 5000,
  });

  const statsQ = useQuery({
    enabled: !!userId,
    queryKey: ["driver-home-stats", userId],
    queryFn: async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const [{ data: doneMonth }, { count: activeCount }, { count: pendingOffers }] = await Promise.all([
        supabase.from("orders").select("price, updated_at").eq("driver_id", userId).in("status", ["delivered","finalized"]).gte("updated_at", monthStart.toISOString()),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("driver_id", userId).not("status", "in", "(delivered,finalized,cancelled)"),
        supabase.from("freight_offers").select("id", { count: "exact", head: true }).eq("driver_id", userId).eq("status","pending"),
      ]);
      const totalMonth = (doneMonth ?? []).reduce((s, o) => s + (Number(o.price) || 0), 0);
      const countMonth = (doneMonth ?? []).length;
      return { totalMonth, countMonth, activeCount: activeCount ?? 0, pendingOffers: pendingOffers ?? 0 };
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`driver-home-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `driver_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["driver-active", userId] });
        qc.invalidateQueries({ queryKey: ["driver-home-stats", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_offers", filter: `driver_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["driver-offers", userId] });
        qc.invalidateQueries({ queryKey: ["driver-home-stats", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const active = activeQ.data;
  const offers = offersQ.data ?? [];

  // Rastreamento automático + automação por geofencing
  const live = useBackgroundTracking(active as never, userId);


  return (
    <div className="space-y-6">
      <div className="bg-surface p-6 -mx-4 mb-6 shadow-sm border-b border-border/40 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Olá, {firstName || "…"}</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {active ? "Você tem um frete em andamento." : offers.length ? `Você tem ${offers.length} oferta(s) esperando.` : "Aguardando novas ofertas."}
          </p>
        </div>
        <div className="h-12 w-12 rounded-full bg-brand/10 grid place-items-center text-brand">
          <Truck className="h-6 w-6" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Ganhos no mês" value={brl(statsQ.data?.totalMonth ?? 0)} icon={<CircleDollarSign className="h-4 w-4" />} />
        <StatCard label="Fretes no mês" value={String(statsQ.data?.countMonth ?? 0)} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Ofertas" value={String(statsQ.data?.pendingOffers ?? 0)} icon={<Package className="h-4 w-4" />} highlight={(statsQ.data?.pendingOffers ?? 0) > 0} />
      </div>

      {active && <ActiveOrderPanel order={active} userId={userId} live={live} onChanged={() => activeQ.refetch()} />}

      {!active && offers.length === 0 && (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Truck className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">Sem ofertas no momento.</p>
          <p className="text-xs text-muted-foreground">Assim que a logística enviar uma oferta você será notificado.</p>
        </div>
      )}

      {!active && offers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Ofertas recentes</h2>
            <Link to="/driver/ofertas" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Ver todas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {offers.map(({ offer, order, program }) => (
            <OfferCard key={offer.id} offer={offer} order={order} program={program} userId={userId} onChanged={() => { activeQ.refetch(); offersQ.refetch(); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-all ${highlight ? "border-brand/40 bg-brand/5 ring-1 ring-brand/10" : "border-border bg-surface"}`}>
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 truncate text-xl font-black tracking-tight">{value}</div>
    </div>
  );
}
