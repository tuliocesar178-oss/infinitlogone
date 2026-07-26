import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, Circle, MapPin, Truck } from "lucide-react";
import { PUBLIC_TIMELINE, publicStatus, STATUS_LABEL } from "@/lib/order-status";

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
  code: string;
  tracking_code: string;
  status: string;
  origin_city: string | null;
  destination_city: string | null;
  origin_address: string | null;
  destination_address: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  driver_first_name: string | null;
  events: { event_type: string; to_status: string | null; created_at: string }[];
};

function TrackingPage() {
  const { code } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["tracking", code],
    queryFn: async (): Promise<TrackingResult | null> => {
      const { data, error } = await supabase.rpc("get_tracking", { _code: code });
      if (error) throw error;
      return (data as TrackingResult | null) ?? null;
    },
  });

  const current = data ? publicStatus(data.status) : null;
  const currentIdx = current ? PUBLIC_TIMELINE.findIndex((t) => t.key === current.key) : -1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/rastreio" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Nova busca
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </span>
            InfinitLog
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {isLoading && <div className="card-soft h-64 animate-pulse bg-surface-2" />}

        {!isLoading && (error || !data) && (
          <div className="card-soft grid place-items-center p-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Pedido não encontrado</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Verifique se o código <span className="font-mono">{code}</span> está correto ou fale com nossa equipe.
            </p>
            <Link to="/rastreio" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Tentar outro código
            </Link>
          </div>
        )}

        {!isLoading && data && current && (
          <>
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Pedido {data.code}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{current.label}</h1>
            {data.driver_first_name && current.key !== "preparing" && (
              <p className="mt-2 text-sm text-muted-foreground">Motorista: {data.driver_first_name}</p>
            )}

            <div className="card-soft mt-8 p-6">
              <div className="flex items-start gap-4">
                <span className="mt-1 grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Origem</div>
                    <div className="mt-0.5">{data.origin_city ?? data.origin_address ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Destino</div>
                    <div className="mt-0.5">{data.destination_city ?? data.destination_address ?? "—"}</div>
                  </div>
                  {data.delivery_window_end && (
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Previsão de entrega</div>
                      <div className="mt-0.5">{new Date(data.delivery_window_end).toLocaleString("pt-BR")}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card-soft mt-6 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Jornada
              </h2>
              <ol className="mt-6 space-y-4">
                {PUBLIC_TIMELINE.map((step, idx) => {
                  const done = currentIdx >= idx && current.key !== "cancelled" && current.key !== "incident";
                  const isCurrent = current.key === step.key;
                  return (
                    <li key={step.key} className="flex items-start gap-3">
                      {done ? (
                        <CheckCircle2 className={`mt-0.5 h-5 w-5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 text-muted-foreground/40" />
                      )}
                      <div>
                        <div className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>
                          {step.label}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {(current.key === "incident" || current.key === "cancelled") && (
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-destructive" />
                    <div className="text-sm font-medium">{current.label}</div>
                  </li>
                )}
              </ol>
            </div>

            {!!data.events?.length && (
              <div className="card-soft mt-6 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Histórico
                </h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {data.events.map((e, i) => (
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
