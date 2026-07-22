import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Package, CheckCircle2, Circle, Truck } from "lucide-react";

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

const STATUS_LABEL: Record<string, string> = {
  created: "Pedido criado",
  preparing: "Em preparação",
  driver_assigned: "Motorista confirmado",
  in_transit_to_pickup: "Em deslocamento",
  picked_up: "Carga coletada",
  out_for_delivery: "Saiu para entrega",
  near_destination: "Próximo ao destino",
  delivered: "Entregue",
  cancelled: "Cancelado",
  incident: "Ocorrência",
};

const TIMELINE = [
  "created",
  "preparing",
  "driver_assigned",
  "in_transit_to_pickup",
  "picked_up",
  "out_for_delivery",
  "near_destination",
  "delivered",
];

function TrackingPage() {
  const { code } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["tracking", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_tracking")
        .select("*")
        .or(`tracking_code.eq.${code},code.eq.${code}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const currentIndex = data ? TIMELINE.indexOf(data.status ?? "created") : -1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Rastreio</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{code}</h1>
          </div>
        </div>

        {isLoading && (
          <div className="card-soft mt-8 h-40 animate-pulse bg-surface-2" />
        )}

        {!isLoading && (error || !data) && (
          <div className="card-soft mt-8 p-8 text-center">
            <h2 className="text-lg font-semibold">Pedido não encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Confira o código de rastreio, o número do pedido ou a nota fiscal.
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="card-soft mt-8 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Status atual</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {STATUS_LABEL[data.status ?? ""] ?? data.status}
                  </p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-brand-foreground">
                  <Truck className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <InfoRow label="Origem" value={data.origin_city} />
                <InfoRow label="Destino" value={data.destination_city} />
                <InfoRow label="Distância" value={data.distance_km ? `${data.distance_km} km` : "—"} />
                <InfoRow
                  label="Previsão"
                  value={data.estimated_minutes ? `${data.estimated_minutes} min` : "—"}
                />
              </div>
            </div>

            <div className="card-soft mt-6 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Linha do tempo
              </h2>
              <ol className="mt-5 space-y-4">
                {TIMELINE.map((s, i) => {
                  const done = i <= currentIndex;
                  const active = i === currentIndex;
                  return (
                    <li key={s} className="flex items-start gap-3">
                      {done ? (
                        <CheckCircle2 className={`mt-0.5 h-5 w-5 ${active ? "text-brand" : "text-primary"}`} />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 text-muted-foreground/40" />
                      )}
                      <div>
                        <div className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>
                          {STATUS_LABEL[s]}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="card-soft mt-6 flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Mapa em tempo real será disponibilizado em breve.
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value ?? "—"}</div>
    </div>
  );
}
