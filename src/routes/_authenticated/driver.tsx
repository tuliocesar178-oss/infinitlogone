import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl, labelOf, PAYMENT_METHODS, PAYMENT_TERMS } from "@/lib/pf";
import { MapPin, Package, CircleDollarSign, Clock, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({ meta: [{ title: "Motorista — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: DriverDashboard,
});

type Status = "available" | "on_trip" | "offline";

function DriverDashboard() {
  const qc = useQueryClient();
  const [name, setName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [status, setStatus] = useState<Status>("offline");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const [{ data: profile }, { data: driver }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle(),
        supabase.from("drivers").select("status").eq("user_id", u.user.id).maybeSingle(),
      ]);
      setName(profile?.full_name ?? u.user.email ?? "Motorista");
      if (driver?.status) setStatus(driver.status as Status);
    })();
  }, []);

  const offersQ = useQuery({
    enabled: !!userId,
    queryKey: ["driver-offers", userId],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("driver_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!offers?.length) return [];
      const orderIds = offers.map((o) => o.order_id);
      const [{ data: orders }, { data: programs }] = await Promise.all([
        supabase.from("orders").select("*").in("id", orderIds),
        supabase.from("freight_programs").select("*").in("order_id", orderIds),
      ]);
      return offers.map((o) => ({
        offer: o,
        order: orders?.find((x) => x.id === o.order_id),
        program: programs?.find((p) => p.order_id === o.order_id),
      }));
    },
  });

  async function updateStatus(next: Status) {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("drivers")
        .upsert(
          { user_id: u.user.id, status: next, last_seen_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      setStatus(next);
      toast.success("Status atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function respond(offerId: string, orderId: string, action: "accept" | "decline") {
    try {
      if (action === "accept") {
        const { error } = await supabase
          .from("freight_offers")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", offerId);
        if (error) throw error;
        toast.success("Oferta aceita — inicie o deslocamento.");
      } else {
        const { error } = await supabase
          .from("freight_offers")
          .update({ status: "declined" })
          .eq("id", offerId);
        if (error) throw error;
        toast.success("Oferta recusada.");
      }
      qc.invalidateQueries({ queryKey: ["driver-offers", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <AppShell title={`Olá, ${name.split(" ")[0]}`} subtitle="Bem-vindo ao painel do motorista.">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="card-soft p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Status
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1.5">
            {(["available", "on_trip", "offline"] as Status[]).map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => updateStatus(s)}
                className={`rounded-xl px-3 py-3 text-sm font-medium transition ${
                  status === s
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "available" && "Disponível"}
                {s === "on_trip" && "Em viagem"}
                {s === "offline" && "Offline"}
              </button>
            ))}
          </div>
        </div>

        {(offersQ.data ?? []).length === 0 ? (
          <div className="card-soft grid place-items-center p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {status === "available"
                ? "Aguardando novas ofertas de frete…"
                : status === "on_trip"
                  ? "Você está em uma viagem ativa."
                  : "Fique offline até estar pronto para receber ofertas."}
            </p>
          </div>
        ) : (
          (offersQ.data ?? []).map(({ offer, order, program }) => (
            <div key={offer.id} className="card-soft overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Nova oferta
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {program?.pf_code ?? order?.code}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {offer.expires_at
                    ? `Expira ${new Date(offer.expires_at).toLocaleTimeString("pt-BR")}`
                    : "Sem prazo"}
                </span>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <Info icon={<MapPin className="h-4 w-4" />} k="Origem" v={order?.origin_city ?? order?.origin_address} />
                <Info icon={<MapPin className="h-4 w-4" />} k="Destino" v={order?.destination_city ?? order?.destination_address} />
                <Info icon={<Package className="h-4 w-4" />} k="Carga" v={order?.cargo_type} />
                <Info k="Peso" v={order?.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : null} />
                <Info k="Volumes" v={order?.volumes} />
                <Info k="Distância" v={order?.distance_km ? `${order.distance_km} km` : null} />
                <Info k="Coleta" v={order?.pickup_window_start ? new Date(order.pickup_window_start).toLocaleString("pt-BR") : null} />
                <Info k="Entrega" v={order?.delivery_window_end ? new Date(order.delivery_window_end).toLocaleString("pt-BR") : null} />
                <Info k="Forma pgto" v={labelOf(PAYMENT_METHODS, program?.payment_method)} />
                <Info k="Prazo" v={labelOf(PAYMENT_TERMS, program?.payment_term)} />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border bg-surface-2 px-6 py-4">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      Valor do frete
                    </div>
                    <div className="text-2xl font-bold">{brl(Number(offer.offered_price))}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => order && respond(offer.id, order.id, "decline")}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
                  >
                    <X className="h-4 w-4" /> Recusar
                  </button>
                  <button
                    onClick={() => order && respond(offer.id, order.id, "accept")}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Check className="h-4 w-4" /> Aceitar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

function Info({
  k,
  v,
  icon,
}: {
  k: string;
  v: any;
  icon?: React.ReactNode;
}) {
  if (v === null || v === undefined || v === "" || v === "—") return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {k}
      </div>
      <div className="mt-0.5 text-sm font-medium">{v}</div>
    </div>
  );
}
