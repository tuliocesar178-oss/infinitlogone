import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl } from "@/lib/pf";
import { readFavorites, routeKey } from "@/lib/driver-prefs";
import { Clock, MessageCircle, Package, History } from "lucide-react";
import { OfferRichCard } from "@/components/driver/offer-rich-card";
import { DriverQuickChat } from "@/components/driver/quick-chat";

export const Route = createFileRoute("/_authenticated/driver/ofertas")({
  head: () => ({ meta: [{ title: "Ofertas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverOffers,
});

type FilterKey = "novas" | "negociacao" | "expirando" | "favoritas" | "todas";

function useFavorites(): string[] {
  const snapshot = useSyncExternalStore(
    (cb) => {
      window.addEventListener("driver-favorites-changed", cb);
      return () => window.removeEventListener("driver-favorites-changed", cb);
    },
    () => JSON.stringify(readFavorites()),
    () => "[]",
  );
  return useMemo(() => JSON.parse(snapshot) as string[], [snapshot]);
}

const EXPIRING_WINDOW_MS = 5 * 60 * 1000;

function DriverOffers() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<FilterKey>("novas");
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const favorites = useFavorites();

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverPos([pos.coords.longitude, pos.coords.latitude]),
      () => console.log("Offers list geo failed")
    );
  }, []);

  // Modal state (compartilhado)
  const [negotiateFor, setNegotiateFor] = useState<{
    offerId: string;
    current: number;
  } | null>(null);
  const [chatFor, setChatFor] = useState<{ orderId: string; code: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-offers-all", userId],
    queryFn: async () => {
      const { data: offers, error: offErr } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("driver_id", userId)
        .in("status", ["pending", "negotiating"])
        .order("created_at", { ascending: false });
      
      if (offErr) {
        console.error("Erro ao buscar todas ofertas:", offErr);
        return [];
      }
      if (!offers?.length) return [];
      
      const ids = offers.map((o) => o.order_id);
      const [{ data: orders }, { data: programs }] = await Promise.all([
        supabase.from("orders").select("*, distance_km, estimated_minutes").in("id", ids),
        supabase.from("freight_programs").select("*").in("order_id", ids),
      ]);
      
      return offers.map((o) => ({
        offer: o,
        order: orders?.find((x) => x.id === o.order_id),
        program: programs?.find((p) => p.order_id === o.order_id),
      })).filter(item => !!item.order);
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`driver-offers-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "freight_offers", filter: `driver_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["driver-offers-all", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const all = q.data ?? [];

  const counts = useMemo(() => {
    let novas = 0,
      negociacao = 0,
      expirando = 0,
      favoritas = 0;
    for (const it of all) {
      if (it.offer.status === "negotiating") negociacao++;
      else {
        novas++;
        if (it.offer.expires_at) {
          const ms = new Date(it.offer.expires_at).getTime() - now;
          if (ms > 0 && ms <= EXPIRING_WINDOW_MS) expirando++;
        }
      }
      if (favorites.includes(routeKey(it.order?.origin_city, it.order?.destination_city)))
        favoritas++;
    }
    return { novas, negociacao, expirando, favoritas, todas: all.length };
  }, [all, now, favorites]);

  const items = useMemo(() => {
    if (filter === "todas") return all;
    if (filter === "negociacao") return all.filter((i) => i.offer.status === "negotiating");
    if (filter === "novas") return all.filter((i) => i.offer.status === "pending");
    if (filter === "favoritas")
      return all.filter((i) =>
        favorites.includes(routeKey(i.order?.origin_city, i.order?.destination_city)),
      );
    return all.filter((i) => {
      if (i.offer.status !== "pending" || !i.offer.expires_at) return false;
      const ms = new Date(i.offer.expires_at).getTime() - now;
      return ms > 0 && ms <= EXPIRING_WINDOW_MS;
    });
  }, [all, filter, now, favorites]);

  const tabs: { key: FilterKey; label: string; count: number; tone?: string }[] = [
    { key: "novas", label: "Novas", count: counts.novas },
    { key: "expirando", label: "Expirando", count: counts.expirando, tone: "text-red-500" },
    { key: "negociacao", label: "Em negociação", count: counts.negociacao, tone: "text-brand" },
    { key: "favoritas", label: "Favoritas", count: counts.favoritas, tone: "text-amber-500" },
    { key: "todas", label: "Todas", count: counts.todas },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ofertas de fretes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as informações no card. Aceite, negocie ou veja detalhes sem sair da tela.
          </p>
        </div>
        <Link
          to="/driver/ofertas/historico"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-accent"
        >
          <History className="h-3.5 w-3.5" /> Histórico
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-surface hover:border-brand/40"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  active ? "bg-white/20 text-brand-foreground" : `bg-surface-2 ${t.tone ?? "text-muted-foreground"}`
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Package className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">
            {filter === "expirando"
              ? "Nenhuma oferta prestes a expirar."
              : filter === "negociacao"
                ? "Nenhuma negociação aguardando resposta."
                : filter === "favoritas"
                  ? "Nenhuma oferta em rotas favoritas."
                  : "Nenhuma oferta aguardando sua resposta."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map(({ offer, order, program }) => {
            const isFav = favorites.includes(
              routeKey(order?.origin_city, order?.destination_city),
            );
            return (
              <li key={offer.id}>
                <OfferRichCard
                  offer={offer as any}
                  order={order as any}
                  pfCode={program?.pf_code ?? null}
                  isFav={isFav}
                  now={now}
                  onOpenDetails={() =>
                    navigate({ to: "/driver/ofertas/$id", params: { id: offer.id } })
                  }
                  onOpenChat={() =>
                    order &&
                    setChatFor({ orderId: order.id, code: program?.pf_code ?? order.code })
                  }
                  onNegotiate={() =>
                    setNegotiateFor({ offerId: offer.id, current: Number(offer.offered_price) })
                  }
                  driverPos={driverPos}
                />
              </li>
            );
          })}
        </ul>
      )}

      {negotiateFor && (
        <NegotiateModal
          currentValue={negotiateFor.current}
          onClose={() => setNegotiateFor(null)}
          onSubmit={async (amount, note) => {
            try {
              const { error: e1 } = await supabase
                .from("freight_offers")
                .update({ status: "negotiating" })
                .eq("id", negotiateFor.offerId);
              if (e1) throw e1;
              const { error: e2 } = await supabase.from("negotiations").insert({
                offer_id: negotiateFor.offerId,
                proposed_by: userId,
                amount,
                note: note || null,
                status: "proposed",
              });
              if (e2) throw e2;
              toast.success("Proposta enviada à logística");
              setNegotiateFor(null);
              qc.invalidateQueries({ queryKey: ["driver-offers-all", userId] });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro");
            }
          }}
        />
      )}

      {chatFor && (
        <DriverQuickChat
          open
          orderId={chatFor.orderId}
          orderCode={chatFor.code}
          onClose={() => setChatFor(null)}
        />
      )}
    </div>
  );
}

function NegotiateModal({
  currentValue,
  onClose,
  onSubmit,
}: {
  currentValue: number;
  onClose: () => void;
  onSubmit: (amount: number, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(currentValue.toFixed(2)).replace(".", ","));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const suggestions = [
    { label: "+5%", pct: 1.05 },
    { label: "+10%", pct: 1.1 },
    { label: "+15%", pct: 1.15 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-6 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand" />
          <h2 className="text-base font-semibold">Negociar valor</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Proposta atual:{" "}
          <span className="font-semibold text-foreground">{brl(currentValue)}</span>
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Sua contraproposta (R$)
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-lg font-semibold outline-none focus:border-brand"
            />
            <div className="mt-2 flex gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() =>
                    setAmount((currentValue * s.pct).toFixed(2).replace(".", ","))
                  }
                  className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold hover:border-brand"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Observações
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex.: pedágio extra, carga fora do padrão…"
              className="w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              const v = Number(amount.replace(/\./g, "").replace(",", "."));
              if (!v || v <= 0) return toast.error("Valor inválido");
              setSaving(true);
              await onSubmit(v, note);
              setSaving(false);
            }}
            className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Enviando…" : "Enviar proposta"}
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" /> Resposta média da logística: 5–10 min
        </div>
      </div>
    </div>
  );
}
