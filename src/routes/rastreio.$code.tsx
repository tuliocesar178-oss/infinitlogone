import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  MapPin,
  PenLine,
  ShieldCheck,
  User,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PUBLIC_TIMELINE, publicStatus, STATUS_LABEL } from "@/lib/order-status";
import { TripMap } from "@/components/trip-map";
import { getPublicTracking } from "@/lib/tracking-public.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/rastreio/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Rastreio ${params.code} — InfinitLog` },
      { name: "description", content: `Acompanhe o pedido ${params.code} em tempo real.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackingPage,
});

type TrackingResult = {
  id: string;
  code: string;
  tracking_code: string;
  status: string;
  origin_city: string | null;
  destination_city: string | null;
  origin_address: string | null;
  destination_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  driver_first_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_speed: number | null;
  driver_heading: number | null;
  distance_to_destination_km: number | null;
  initial_distance_km: number | null;
  eta_minutes: number | null;
  current_city: string | null;
  last_ping_at: string | null;
  last_update_at: string | null;
  events: { event_type: string; to_status: string | null; created_at: string }[];
  delivery: {
    delivered_at: string | null;
    receiver_name: string | null;
    receiver_document: string | null;
    pickup_photo_url: string | null;
    delivery_photo_url: string | null;
    signature_url: string | null;
    invoice_url: string | null;
  } | null;
};

function TrackingPage() {
  const { code } = Route.useParams();
  const fetchTracking = useServerFn(getPublicTracking);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tracking", code],
    queryFn: async (): Promise<TrackingResult | null> => {
      const result = await fetchTracking({ data: { code: code.trim().toUpperCase() } });
      return (result as TrackingResult | null) ?? null;
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!data) return;
    const ch = supabase
      .channel(`track-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${data.id}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_events", filter: `order_id=eq.${data.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [code, data, refetch]);

  const current = data ? publicStatus(data.status) : null;
  const currentIdx = useMemo(
    () => (current ? PUBLIC_TIMELINE.findIndex((t) => t.key === current.key) : -1),
    [current],
  );
  const progressPct = useMemo(() => {
    if (currentIdx < 0) return 0;
    return Math.round(((currentIdx + 1) / PUBLIC_TIMELINE.length) * 100);
  }, [currentIdx]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link
            to="/rastreio"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Nova busca
          </Link>
          <Link to="/" aria-label="InfinitLog">
            <Logo size={30} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        {isLoading && <div className="card-soft h-64 animate-pulse bg-surface-2" />}

        {!isLoading && (error || !data) && (
          <div className="card-soft grid place-items-center p-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-destructive">Pedido não encontrado</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Não conseguimos localizar o pedido <span className="font-mono font-bold text-foreground">{code}</span>. 
              Certifique-se de que o código está correto ou que o frete já foi iniciado pela logística.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/rastreio"
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20"
              >
                Tentar outro código
              </Link>
              <button 
                onClick={() => refetch()}
                className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-semibold hover:bg-accent"
              >
                Atualizar página
              </button>
            </div>
          </div>
        )}

        {!isLoading && data && current && (
          <>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Pedido {data.code} · Rastreio <span className="font-mono">{data.tracking_code}</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{current.label}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {data.driver_first_name && current.key !== "preparing" && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" /> {data.driver_first_name}
                </span>
              )}
              {data.last_update_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Atualizado {relativeTime(data.last_update_at)}
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="card-soft mt-8 p-6">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <span>Progresso</span>
                <span>{progressPct}%</span>
              </div>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <ol className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {PUBLIC_TIMELINE.map((step, idx) => {
                  const done = currentIdx > idx && current.key !== "cancelled" && current.key !== "incident";
                  const isCurrent = currentIdx === idx;
                  return (
                    <li key={step.key} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
                      <div className="relative">
                        {done ? (
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        ) : isCurrent ? (
                          <span className="relative grid h-6 w-6 place-items-center">
                            <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                            <span className="relative grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                              •
                            </span>
                          </span>
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div
                        className={`text-xs leading-tight ${
                          done || isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {(current.key === "incident" || current.key === "cancelled") && (
                <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {current.label}
                </div>
              )}
            </div>

            {/* Route */}
            <div className="card-soft mt-6 p-6">
              <div className="flex items-start gap-4">
                <span className="mt-1 grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-4 text-sm">
                  <RouteRow label="Origem" value={data.origin_city ?? data.origin_address} />
                  <RouteRow label="Destino" value={data.destination_city ?? data.destination_address} />
                  {(data.driver_lat != null && data.driver_lng != null) && (
                    <RouteRow
                      label="Posição atual do veículo"
                      value={`${data.driver_lat.toFixed(3)}, ${data.driver_lng.toFixed(3)}`}
                    />
                  )}
                  {data.delivery_window_end && (
                    <RouteRow
                      label="Previsão de entrega"
                      value={new Date(data.delivery_window_end).toLocaleString("pt-BR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Live map + approach mode */}
            {(data.driver_lat != null && data.driver_lng != null) ||
            (data.destination_lat != null && data.destination_lng != null) ? (
              <div className="card-soft mt-6 overflow-hidden p-0">
                {data.distance_to_destination_km != null &&
                  data.distance_to_destination_km <= 20 &&
                  current.key !== "delivered" && (
                    <div className="flex items-center justify-between gap-4 border-b border-primary/20 bg-primary/5 px-6 py-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          Modo aproximação
                        </div>
                        <div className="mt-0.5 text-sm">
                          Motorista a{" "}
                          <span className="font-semibold">
                            {data.distance_to_destination_km.toFixed(1)} km
                          </span>{" "}
                          do destino
                          {data.eta_minutes != null && (
                            <> · chega em ~{data.eta_minutes} min</>
                          )}
                        </div>
                      </div>
                      <div className="hidden text-right sm:block">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Progresso
                        </div>
                        <div className="text-sm font-semibold">
                          {data.initial_distance_km && data.initial_distance_km > 0
                            ? `${Math.min(
                                100,
                                Math.round(
                                  ((data.initial_distance_km -
                                    data.distance_to_destination_km) /
                                    data.initial_distance_km) *
                                    100,
                                ),
                              )}%`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  )}
                <div className="h-80">
                  <TripMap
                    className="h-full w-full"
                    driver={
                      data.driver_lat != null && data.driver_lng != null
                        ? { lat: data.driver_lat, lng: data.driver_lng }
                        : null
                    }
                    origin={
                      data.origin_lat != null && data.origin_lng != null
                        ? { lat: data.origin_lat, lng: data.origin_lng }
                        : null
                    }
                    destination={
                      data.destination_lat != null && data.destination_lng != null
                        ? { lat: data.destination_lat, lng: data.destination_lng }
                        : null
                    }
                    interactive={true}
                  />
                </div>
              </div>
            ) : null}


            {/* Delivery evidence */}
            {data.delivery && (
              <div className="card-soft mt-6 p-6">
                <header className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Comprovante de entrega
                  </h2>
                </header>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  {data.delivery.receiver_name && (
                    <Info k="Recebido por" v={data.delivery.receiver_name} />
                  )}
                  {data.delivery.receiver_document && (
                    <Info k="Documento" v={data.delivery.receiver_document} />
                  )}
                  {data.delivery.delivered_at && (
                    <Info
                      k="Data e hora"
                      v={new Date(data.delivery.delivered_at).toLocaleString("pt-BR")}
                    />
                  )}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <EvidenceTile icon={<Camera className="h-4 w-4" />} label="Foto da carga" url={data.delivery.delivery_photo_url} />
                  <EvidenceTile icon={<Camera className="h-4 w-4" />} label="Coleta" url={data.delivery.pickup_photo_url} />
                  <EvidenceTile icon={<PenLine className="h-4 w-4" />} label="Canhoto" url={data.delivery.signature_url} />
                  <EvidenceTile icon={<FileText className="h-4 w-4" />} label="Nota Fiscal" url={data.delivery.invoice_url} />
                </div>
              </div>
            )}

            {/* History */}
            {!!data.events?.length && (
              <div className="card-soft mt-6 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Histórico
                </h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {[...data.events].reverse().map((e, i) => (
                    <li key={i} className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">
                        {STATUS_LABEL[e.to_status ?? ""] ?? e.event_type}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function RouteRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-medium">{v}</div>
    </div>
  );
}

function EvidenceTile({ icon, label, url }: { icon: React.ReactNode; label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-border bg-surface-2 text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </div>
      </div>
    );
  }
  const isImage = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className="group relative block aspect-square overflow-hidden rounded-2xl bg-surface-2"
    >
      {isImage ? (
        <img src={url} alt={label} className="h-full w-full object-cover transition group-hover:scale-105" />
      ) : (
        <div className="grid h-full place-items-center text-muted-foreground">
          <FileText className="h-8 w-8" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
        {icon} {label}
      </div>
    </a>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}
