import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, Star, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { notifyDriversNewOffer } from "@/lib/push.functions";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function DispatchPanel({ order, onSent }: { order: any; onSent: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState<number>(order.price ?? 0);
  const [minutes, setMinutes] = useState(15);
  const [sending, setSending] = useState(false);

  const driversQ = useQuery({
    queryKey: ["dispatch-drivers", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("user_id,current_lat,current_lng,rating,status,availability,city,phone,last_seen_at")
        .in("availability", ["disponivel", "available", "on_trip"]);
      if (error) throw error;
      
      const { data: previousOffers } = await supabase
        .from("freight_offers")
        .select("driver_id, status")
        .eq("order_id", order.id);

      const list = data ?? [];
      const ids = list.map((d: any) => d.user_id);
      let profilesMap: Record<string, { full_name: string | null }> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        profilesMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name }]));
      }
      return list.map((d: any) => ({ 
        ...d, 
        profiles: profilesMap[d.user_id] ?? null,
        previousStatus: previousOffers?.find(o => o.driver_id === d.user_id)?.status
      }));
    },
  });

  const ranked = useMemo(() => {
    const list = (driversQ.data ?? []).map((d: any) => {
      const distance =
        order.origin_lat != null && order.origin_lng != null && d.current_lat != null && d.current_lng != null
          ? haversineKm(order.origin_lat, order.origin_lng, d.current_lat, d.current_lng)
          : null;
      const rating = Number(d.rating ?? 0);
      // Score: closer + higher rating = better. Lower score = better.
      const score = (distance ?? 999) - rating * 3;
      return { ...d, distance, score };
    });
    return list.sort((a, b) => a.score - b.score);
  }, [driversQ.data, order.origin_lat, order.origin_lng]);

  const best = ranked[0]?.user_id;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) {
      toast.warning("Selecione ao menos um motorista.");
      return;
    }
    setSending(true);
    try {
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const rows = Array.from(selected).map((driver_id) => ({
        order_id: order.id,
        driver_id,
        offered_price: price,
        expires_at: expiresAt,
      }));
      // Upsert para permitir reenvio de ofertas (substituindo a antiga se existir)
      const { error } = await supabase
        .from("freight_offers")
        .upsert(
          rows.map(r => ({ ...r, status: 'pending' })), 
          { onConflict: 'order_id,driver_id' }
        );
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("orders").update({ status: "awaiting_driver", price }).eq("id", order.id);
      await supabase.from("order_events").insert({
        order_id: order.id,
        event_type: "offers_sent",
        from_status: order.status,
        to_status: "awaiting_driver",
        actor_id: u.user?.id ?? null,
        payload: { drivers: rows.length, price, expires_in_min: minutes },
      });
      // Push imediato para os motoristas — não bloqueia o fluxo se falhar.
      try {
        await notifyDriversNewOffer({
          data: {
            driverIds: rows.map((r) => r.driver_id),
            orderCode: order.code,
            origin: order.origin_city ?? order.origin_address ?? "Origem",
            destination: order.destination_city ?? order.destination_address ?? "Destino",
            price,
          },
        });
      } catch (pushError) {
        console.warn("[Push] falha ao notificar motoristas", pushError);
      }
      toast.success(`Oferta enviada para ${rows.length} motorista(s).`);
      setSelected(new Set());
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar ofertas");
    } finally {
      setSending(false);
    }
  }

  if (order.status !== "preparing" && order.status !== "created" && order.status !== "awaiting_driver") {
    return null;
  }

  return (
    <section className="card-soft p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Despacho inteligente
        </h2>
        <span className="text-xs text-muted-foreground">{ranked.length} disponíveis</span>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Valor da oferta (R$)
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Expira em (min)
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none"
          />
        </label>
      </div>

      <ul className="max-h-96 space-y-2 overflow-auto">
        {driversQ.isLoading && <li className="text-sm text-muted-foreground">Carregando…</li>}
        {ranked.map((d: any) => {
          const isBest = d.user_id === best;
          const isSel = selected.has(d.user_id);
          return (
            <li
              key={d.user_id}
              onClick={() => toggle(d.user_id)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${
                isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {d.profiles?.full_name ?? "Motorista"}
                  </span>
                  {isBest && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                      <Star className="h-3 w-3 fill-current" /> Melhor opção
                    </span>
                  )}
                  {d.previousStatus === 'declined' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      Recusou anteriormente
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {d.distance != null ? `${d.distance.toFixed(1)} km` : d.city ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3 w-3" /> ★ {Number(d.rating ?? 0).toFixed(1)}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggle(d.user_id)}
                className="h-4 w-4"
              />
            </li>
          );
        })}
        {!driversQ.isLoading && ranked.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhum motorista disponível.</li>
        )}
      </ul>

      <button
        onClick={send}
        disabled={sending || selected.size === 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {sending ? "Enviando…" : `Enviar oferta (${selected.size})`}
      </button>
    </section>
  );
}
