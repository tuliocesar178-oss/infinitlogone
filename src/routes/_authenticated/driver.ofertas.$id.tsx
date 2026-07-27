import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl, labelOf, PAYMENT_METHODS, PAYMENT_TERMS } from "@/lib/pf";
import { haversineKm } from "@/lib/geo";
import {
  ArrowLeft,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Package,
  Truck,
  X,
  Navigation,
  FileText,
  Weight,
  Calendar,
  Layers,
  AlertTriangle,
  Star,
  Phone,
  Zap,
} from "lucide-react";
import { DriverQuickChat } from "@/components/driver/quick-chat";
import { isFavorite, readDriveMode, setDriveMode, toggleFavorite } from "@/lib/driver-prefs";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
if (TOKEN) mapboxgl.accessToken = TOKEN;

export const Route = createFileRoute("/_authenticated/driver/ofertas/$id")({
  head: () => ({ meta: [{ title: "Detalhes da oferta — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: OfferDetail,
});

function OfferDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [busy, setBusy] = useState<null | "accept" | "decline" | "negotiate">(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [fav, setFav] = useState(false);
  const [driveMode, setDrive] = useState<boolean>(() => (typeof window === "undefined" ? false : readDriveMode()));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
  }, []);

  useEffect(() => {
    const onChange = () => setDrive(readDriveMode());
    window.addEventListener("driver-drive-mode-changed", onChange);
    return () => window.removeEventListener("driver-drive-mode-changed", onChange);
  }, []);


  const q = useQuery({
    enabled: !!id && !!userId,
    queryKey: ["driver-offer-detail", id, userId],
    queryFn: async () => {
      const { data: offer, error } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!offer) return null;
      const [{ data: order }, { data: program }, { data: negotiations }, { data: driver }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", offer.order_id).maybeSingle(),
        supabase.from("freight_programs").select("*").eq("order_id", offer.order_id).maybeSingle(),
        supabase.from("negotiations").select("*").eq("offer_id", id).order("created_at", { ascending: false }),
        supabase.from("drivers").select("current_lat,current_lng,default_price_per_km").eq("user_id", userId).maybeSingle(),
      ]);
      return { offer, order, program, negotiations: negotiations ?? [], driver };
    },
  });

  const data = q.data;
  const offer = data?.offer;
  const order = data?.order;
  const program = data?.program;
  const driver = data?.driver;

  useEffect(() => {
    if (order) setFav(isFavorite(order.origin_city, order.destination_city));
  }, [order?.id, order?.origin_city, order?.destination_city]);

  // Custo por km ajustável pelo motorista (persistido em localStorage)
  const [costPerKm, setCostPerKm] = useState<number>(() => {
    if (typeof window === "undefined") return 2.2;
    const saved = Number(window.localStorage.getItem("driver:cost_per_km") ?? "");
    return saved > 0 ? saved : Number(driver?.default_price_per_km ?? 2.2) || 2.2;
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("driver:cost_per_km", String(costPerKm));
  }, [costPerKm]);

  const distanceKm = useMemo(() => {
    if (order?.distance_km) return Number(order.distance_km);
    if (
      order?.origin_lat && order?.origin_lng &&
      order?.destination_lat && order?.destination_lng
    ) {
      return haversineKm(
        { lat: order.origin_lat, lng: order.origin_lng },
        { lat: order.destination_lat, lng: order.destination_lng },
      );
    }
    return null;
  }, [order]);

  const etaMinutes = useMemo(() => {
    if (order?.estimated_minutes) return Number(order.estimated_minutes);
    if (distanceKm) return Math.round((distanceKm / 60) * 60); // ~60 km/h
    return null;
  }, [order, distanceKm]);

  const emptyKm = useMemo(() => {
    if (!driver?.current_lat || !driver?.current_lng) return null;
    if (!order?.origin_lat || !order?.origin_lng) return null;
    return haversineKm(
      { lat: driver.current_lat, lng: driver.current_lng },
      { lat: order.origin_lat, lng: order.origin_lng },
    );
  }, [driver, order]);

  const profit = useMemo(() => {
    if (!offer || !distanceKm) return null;
    const gross = Number(offer.offered_price ?? 0);
    const totalKm = distanceKm + (emptyKm ?? 0);
    const cost = totalKm * costPerKm;
    const net = gross - cost;
    const marginPct = gross > 0 ? (net / gross) * 100 : 0;
    const pricePerKm = distanceKm > 0 ? gross / distanceKm : 0;
    return { gross, cost, net, marginPct, totalKm, pricePerKm };
  }, [offer, distanceKm, emptyKm, costPerKm]);

  async function respond(action: "accept" | "decline") {
    if (!offer) return;
    setBusy(action);
    try {
      const patch = action === "accept"
        ? { status: "accepted" as const, accepted_at: new Date().toISOString() }
        : { status: "declined" as const };
      const { error } = await supabase.from("freight_offers").update(patch).eq("id", offer.id);
      if (error) throw error;
      toast.success(action === "accept" ? "Oferta aceita — frete em Minhas Rotas" : "Oferta recusada");
      qc.invalidateQueries();
      navigate({ to: action === "accept" ? "/driver" : "/driver/ofertas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!data || !offer || !order) {
    return (
      <div className="card-soft grid place-items-center p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="mt-3 text-sm text-muted-foreground">Oferta não encontrada ou expirada.</p>
        <Link to="/driver/ofertas" className="mt-4 text-sm font-semibold text-brand hover:underline">
          Voltar às ofertas
        </Link>
      </div>
    );
  }

  const isNegotiating = offer.status === "negotiating";
  const priority = (order.priority ?? "").toLowerCase();
  const priorityLabel: Record<string, { label: string; cls: string }> = {
    alta: { label: "Prioridade alta", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
    media: { label: "Prioridade média", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    baixa: { label: "Prioridade baixa", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  };
  const prio = priorityLabel[priority];

  const phone = (order as any).contact_phone as string | null | undefined;
  const telHref = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : null;

  return (
    <div className={`-mx-4 -mt-6 pb-32 ${driveMode ? "text-lg leading-relaxed" : ""}`}>
      {/* Header */}
      <div className="sticky top-16 z-20 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
        <Link
          to="/driver/ofertas"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {program?.pf_code ?? order.code}
          </div>
          <Countdown expiresAt={offer.expires_at} createdAt={offer.created_at} />
        </div>
        <div className="flex items-center gap-1.5">
          {prio ? (
            <span className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline ${prio.cls}`}>
              {prio.label}
            </span>
          ) : null}
          <button
            onClick={() => {
              const next = !driveMode;
              setDrive(next);
              setDriveMode(next);
            }}
            className={`grid h-9 w-9 place-items-center rounded-full border ${
              driveMode ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface hover:bg-accent"
            }`}
            aria-label="Modo direção"
            title="Modo direção (texto grande)"
          >
            <Zap className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const next = toggleFavorite(order.origin_city, order.destination_city);
              setFav(next);
            }}
            className={`grid h-9 w-9 place-items-center rounded-full border ${
              fav ? "border-amber-400 bg-amber-100 text-amber-700" : "border-border bg-surface hover:bg-accent"
            }`}
            aria-label="Favoritar rota"
            title={fav ? "Remover dos favoritos" : "Favoritar rota"}
          >
            <Star className={`h-4 w-4 ${fav ? "fill-amber-500 stroke-amber-500" : ""}`} />
          </button>
          {telHref && (
            <a
              href={telHref}
              className="grid h-9 w-9 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
              aria-label="Ligar para contato"
              title={`Ligar para ${phone}`}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => setChatOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface hover:bg-accent"
            aria-label="Chat com a logística"
            title="Chat com a logística"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map */}
      <RouteMap
        origin={order.origin_lat && order.origin_lng ? { lat: order.origin_lat, lng: order.origin_lng } : null}
        destination={order.destination_lat && order.destination_lng ? { lat: order.destination_lat, lng: order.destination_lng } : null}
      />

      {/* Content */}
      <div className="space-y-5 px-4 pt-4">
        {isNegotiating && (
          <div className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <MessageCircle className="mt-0.5 h-5 w-5 text-brand" />
            <div>
              <div className="text-sm font-semibold text-brand">Aguardando resposta da logística</div>
              <div className="text-xs text-muted-foreground">
                Sua contraproposta foi enviada. Você receberá uma notificação quando houver retorno.
              </div>
            </div>
          </div>
        )}

        {/* Value hero */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-brand to-brand/80 p-6 text-brand-foreground">
          <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Valor do frete</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">{brl(Number(offer.offered_price))}</div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            {distanceKm != null && (
              <div>
                <div className="opacity-70">Distância</div>
                <div className="font-semibold">{distanceKm.toFixed(0)} km</div>
              </div>
            )}
            {etaMinutes != null && (
              <div>
                <div className="opacity-70">Tempo estimado</div>
                <div className="font-semibold">{formatDuration(etaMinutes)}</div>
              </div>
            )}
            {distanceKm && (
              <div>
                <div className="opacity-70">Ganho por km</div>
                <div className="font-semibold">{brl(Number(offer.offered_price) / distanceKm)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Selos operacionais */}
        <div className="flex flex-wrap gap-2">
          {prio && (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${prio.cls}`}>
              {prio.label}
            </span>
          )}
          {(order.priority ?? "").toLowerCase() === "alta" && (
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white">
              🔥 Carga Urgente
            </span>
          )}
          {order.origin_state && order.destination_state && (
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold">
              {order.origin_state} → {order.destination_state}
            </span>
          )}
        </div>

        {/* Resumo da Viagem */}
        <TripSummary
          distanceKm={distanceKm}
          etaMinutes={etaMinutes}
          weightKg={order.cargo_weight_kg ? Number(order.cargo_weight_kg) : null}
          gross={Number(offer.offered_price)}
          origin={order.origin_city ?? order.origin_address}
          destination={order.destination_city ?? order.destination_address}
        />

        {/* Ganho Estimado (com pedágios e combustível) */}
        <EstimatedEarnings
          gross={Number(offer.offered_price)}
          distanceKm={distanceKm}
        />


        {/* Rentabilidade */}
        {profit && (
          <div className="card-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Rentabilidade estimada
                </div>
                <div className="mt-0.5 text-lg font-bold tracking-tight">
                  {profit.net >= 0 ? "+" : ""}{brl(profit.net)}
                  <span className={`ml-2 text-xs font-semibold ${profit.marginPct >= 30 ? "text-emerald-600" : profit.marginPct >= 15 ? "text-amber-600" : "text-red-600"}`}>
                    {profit.marginPct.toFixed(0)}% líquido
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Km vazios</div>
                <div className="text-sm font-semibold">
                  {emptyKm != null ? `${emptyKm.toFixed(0)} km` : "—"}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-surface p-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bruto</div>
                <div className="mt-0.5 font-semibold">{brl(profit.gross)}</div>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Custo estimado</div>
                <div className="mt-0.5 font-semibold">{brl(profit.cost)}</div>
              </div>
              <div className="rounded-lg bg-surface p-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total rodado</div>
                <div className="mt-0.5 font-semibold">{profit.totalKm.toFixed(0)} km</div>
              </div>
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-xs">
              <span className="text-muted-foreground">Meu custo por km</span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">R$</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={costPerKm}
                  onChange={(e) => setCostPerKm(Number(e.target.value) || 0)}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right font-semibold outline-none focus:border-brand"
                />
              </span>
            </label>
            {profit.marginPct < 15 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Rentabilidade baixa. Considere negociar o valor antes de aceitar.</span>
              </div>
            )}
          </div>
        )}

        {/* Route */}
        <div className="card-soft p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex flex-col items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="h-8 w-px bg-border" />
              <span className="h-3 w-3 rounded-full bg-red-500 ring-4 ring-red-500/20" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coleta</div>
                <div className="text-sm font-semibold">{order.origin_city ?? "—"}</div>
                <div className="truncate text-xs text-muted-foreground">{order.origin_address}</div>
                {order.pickup_window_start && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(order.pickup_window_start)}
                    {order.pickup_window_end ? ` – ${formatTime(order.pickup_window_end)}` : ""}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Entrega</div>
                <div className="text-sm font-semibold">{order.destination_city ?? "—"}</div>
                <div className="truncate text-xs text-muted-foreground">{order.destination_address}</div>
                {order.delivery_window_end && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(order.delivery_window_start ?? order.delivery_window_end)}
                    {order.delivery_window_end ? ` – ${formatTime(order.delivery_window_end)}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cargo & payment grid */}
        <div className="card-soft grid grid-cols-2 gap-4 p-4">
          <Info icon={<Package className="h-3.5 w-3.5" />} k="Tipo de carga" v={order.cargo_type} />
          <Info icon={<Weight className="h-3.5 w-3.5" />} k="Peso" v={order.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : null} />
          <Info icon={<Layers className="h-3.5 w-3.5" />} k="Volumes" v={order.volumes} />
          <Info icon={<Truck className="h-3.5 w-3.5" />} k="Veículo sugerido" v="A definir" />
          <Info icon={<FileText className="h-3.5 w-3.5" />} k="Valor da NF" v={order.invoice_value ? brl(Number(order.invoice_value)) : null} />
          <Info k="Nº NF" v={order.invoice_number} />
          <Info k="Forma pgto" v={labelOf(PAYMENT_METHODS, program?.payment_method)} />
          <Info k="Prazo pgto" v={labelOf(PAYMENT_TERMS, program?.payment_term)} />
        </div>

        {order.notes && (
          <div className="card-soft p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Observações da logística
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{order.notes}</p>
          </div>
        )}

        {data.negotiations.length > 0 && (
          <div className="card-soft p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Histórico de negociação
            </div>
            <ul className="mt-2 space-y-2">
              {data.negotiations.map((n: any) => (
                <li key={n.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")} · {n.status}
                  </span>
                  <span className="font-semibold">{brl(Number(n.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
          <button
            disabled={!!busy || isNegotiating}
            onClick={() => respond("decline")}
            className="flex items-center justify-center gap-1 rounded-2xl border border-border bg-background py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Recusar
          </button>
          <button
            disabled={!!busy || isNegotiating}
            onClick={() => setNegotiateOpen(true)}
            className="flex items-center justify-center gap-1 rounded-2xl border border-brand bg-background py-3 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" /> Negociar
          </button>
          <button
            disabled={!!busy || isNegotiating}
            onClick={() => respond("accept")}
            className="flex items-center justify-center gap-1 rounded-2xl bg-brand py-3 text-sm font-bold text-brand-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Aceitar
          </button>
        </div>
      </div>

      {negotiateOpen && (
        <NegotiateModal
          currentValue={Number(offer.offered_price)}
          onClose={() => setNegotiateOpen(false)}
          onSubmit={async (amount, note) => {
            try {
              const { error: e1 } = await supabase.from("freight_offers").update({ status: "negotiating" }).eq("id", offer.id);
              if (e1) throw e1;
              const { error: e2 } = await supabase.from("negotiations").insert({
                offer_id: offer.id, proposed_by: userId, amount, note: note || null, status: "proposed",
              });
              if (e2) throw e2;
              toast.success("Proposta enviada à logística");
              setNegotiateOpen(false);
              qc.invalidateQueries();
              q.refetch();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro");
            }
          }}
        />
      )}

      <DriverQuickChat
        open={chatOpen}
        orderId={order.id}
        orderCode={program?.pf_code ?? order.code}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}

function RouteMap({
  origin,
  destination,
}: {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!container.current || !TOKEN || !origin || !destination) return;
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [(origin.lng + destination.lng) / 2, (origin.lat + destination.lat) / 2],
      zoom: 5,
      attributionControl: false,
    });
    mapRef.current = map;

    new mapboxgl.Marker({ color: "#10b981" }).setLngLat([origin.lng, origin.lat]).addTo(map);
    new mapboxgl.Marker({ color: "#ef4444" }).setLngLat([destination.lng, destination.lat]).addTo(map);

    const bounds = new mapboxgl.LngLatBounds()
      .extend([origin.lng, origin.lat])
      .extend([destination.lng, destination.lat]);
    map.fitBounds(bounds, { padding: 60, duration: 0 });

    map.on("load", async () => {
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=full&access_token=${TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        const geom = data?.routes?.[0]?.geometry;
        if (!geom) return;
        map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: geom, properties: {} } });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#0d1b4a", "line-width": 5, "line-opacity": 0.9 },
        });
      } catch {
        // fallback: linha reta
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
            },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: { "line-color": "#0d1b4a", "line-width": 4, "line-dasharray": [2, 2] },
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  if (!origin || !destination) {
    return (
      <div className="grid h-[38vh] min-h-[240px] place-items-center bg-surface-2 text-center text-xs text-muted-foreground">
        <div>
          <MapPin className="mx-auto mb-2 h-6 w-6" />
          Coordenadas de rota indisponíveis
        </div>
      </div>
    );
  }
  return <div ref={container} className="h-[38vh] min-h-[240px] w-full" />;
}

function Countdown({ expiresAt, createdAt }: { expiresAt: string | null; createdAt?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return <div className="text-xs text-muted-foreground">Sem prazo</div>;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <div className="text-xs font-semibold text-red-500">Oferta expirada</div>;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const urgent = ms < 60_000;
  const window = createdAt ? new Date(expiresAt).getTime() - new Date(createdAt).getTime() : null;
  const pct = window ? Math.max(0, Math.min(100, (ms / window) * 100)) : null;
  return (
    <div>
      <div className={`inline-flex items-center gap-1 text-xs font-semibold ${urgent ? "text-red-500" : "text-brand"}`}>
        <Clock className="h-3 w-3" /> Expira em {label}
      </div>
      {pct !== null && (
        <div className="mx-auto mt-1 h-1 w-32 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full transition-all ${urgent ? "bg-red-500" : "bg-brand"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-6 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-brand" />
          <h2 className="text-base font-semibold">Negociar valor</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Proposta atual: <span className="font-semibold text-foreground">{brl(currentValue)}</span>
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sua contraproposta (R$)</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-lg font-semibold"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Observações</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex.: pedágio extra, carga fora do padrão…"
              className="w-full rounded-xl border border-border bg-surface p-3 text-sm"
            />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm hover:bg-accent">
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
      </div>
    </div>
  );
}

function Info({ icon, k, v }: { icon?: React.ReactNode; k: string; v: unknown }) {
  if (v === null || v === undefined || v === "" || v === "—") {
    return (
      <div>
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {icon} {k}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground/60">—</div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon} {k}
      </div>
      <div className="mt-0.5 text-sm font-medium">{String(v)}</div>
    </div>
  );
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function TripSummary({
  distanceKm,
  etaMinutes,
  weightKg,
  gross,
  origin,
  destination,
}: {
  distanceKm: number | null;
  etaMinutes: number | null;
  weightKg: number | null;
  gross: number;
  origin: string | null;
  destination: string | null;
}) {
  const fuelLiters = distanceKm ? distanceKm / 3.5 : null;
  return (
    <div className="card-soft p-4">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        📋 Resumo da viagem
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCell icon="🚚" label="Distância" value={distanceKm ? `${distanceKm.toFixed(0)} km` : "—"} />
        <SummaryCell icon="🕒" label="Tempo estimado" value={etaMinutes ? formatDuration(etaMinutes) : "—"} />
        <SummaryCell
          icon="⛽"
          label="Combustível est."
          value={fuelLiters ? `${fuelLiters.toFixed(0)} L` : "—"}
        />
        <SummaryCell icon="💰" label="Valor do frete" value={brl(gross)} />
        <SummaryCell icon="📦" label="Peso" value={weightKg ? `${weightKg} kg` : "—"} />
        <SummaryCell icon="📍" label="Origem" value={origin ?? "—"} />
        <SummaryCell icon="🏁" label="Destino" value={destination ?? "—"} className="col-span-2 sm:col-span-1" />
      </div>
    </div>
  );
}

function SummaryCell({
  icon,
  label,
  value,
  className,
}: {
  icon: string;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-surface p-3 ${className ?? ""}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function EstimatedEarnings({
  gross,
  distanceKm,
}: {
  gross: number;
  distanceKm: number | null;
}) {
  if (!distanceKm) return null;
  const fuelCost = (distanceKm / 3.5) * 6.0;
  const tollCost = distanceKm * 0.15;
  const net = gross - fuelCost - tollCost;
  const pct = gross > 0 ? (net / gross) * 100 : 0;
  const tone =
    pct >= 40 ? "text-emerald-600" : pct >= 20 ? "text-amber-600" : "text-red-600";
  return (
    <div className="card-soft overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-brand/5 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          💵 Ganho estimado
        </span>
        <span className={`text-[11px] font-bold ${tone}`}>{pct.toFixed(0)}% líquido</span>
      </div>
      <div className="divide-y divide-border/50">
        <EarningsRow label="Valor do frete" value={brl(gross)} tone="text-foreground font-semibold" />
        <EarningsRow
          label="Estimativa de pedágios"
          value={`- ${brl(tollCost)}`}
          tone="text-muted-foreground"
          hint={`~ R$ 0,15/km · ${distanceKm.toFixed(0)} km`}
        />
        <EarningsRow
          label="Estimativa de combustível"
          value={`- ${brl(fuelCost)}`}
          tone="text-muted-foreground"
          hint={`~ 3,5 km/L · R$ 6,00/L`}
        />
        <EarningsRow
          label="Lucro líquido estimado"
          value={brl(net)}
          tone={`text-lg font-bold ${tone}`}
        />
      </div>
      <div className="border-t border-border/60 bg-surface px-4 py-2 text-[10px] text-muted-foreground">
        Valores aproximados. Estimativa não inclui alimentação, hospedagem ou manutenção.
      </div>
    </div>
  );
}

function EarningsRow({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <div>
        <div>{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <div className={tone}>{value}</div>
    </div>
  );
}

