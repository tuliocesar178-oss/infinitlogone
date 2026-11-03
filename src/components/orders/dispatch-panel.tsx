import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  dispatchOrderToDriver,
  dispatchOrderToEligibleDrivers,
  getDispatchStatus,
  listDispatchableDrivers,
} from "@/lib/dispatch.functions";
import {
  DISPATCH_MODE_LABELS,
  availabilityLabel,
  countOffersByStatus,
  filterDispatchDrivers,
  minutesRemaining,
  type DispatchMode,
} from "@/lib/dispatch-model";
import { cn } from "@/lib/utils";

const OFFER_STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando aceite",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
  cancelled: "Cancelada",
  negotiating: "Em negociação",
};

function DispatchStatus({ orderId, refreshKey }: { orderId: string; refreshKey: number }) {
  const fetchStatus = useServerFn(getDispatchStatus);
  const statusQ = useQuery({
    queryKey: ["dispatch-status", orderId, refreshKey],
    queryFn: () => fetchStatus({ data: { order_id: orderId } }),
    refetchInterval: 15_000,
  });
  const status = statusQ.data;
  if (!status || (!status.modality && status.offers.length === 0)) return null;

  const counts = countOffersByStatus(status.offers);
  const latestPending = status.offers.find((offer) => offer.status === "pending");
  const remaining = minutesRemaining(latestPending?.expires_at);

  return (
    <section className="card-soft p-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Acompanhamento do despacho
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        {status.modality && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Modalidade</dt>
            <dd className="font-medium text-foreground">{DISPATCH_MODE_LABELS[status.modality]}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Motoristas notificados</dt>
          <dd className="font-medium text-foreground">{status.notified}</dd>
        </div>
        {status.modality === "manual" && status.selectedDriverName && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Motorista selecionado</dt>
            <dd className="font-medium text-foreground">{status.selectedDriverName}</dd>
          </div>
        )}
        {status.sentAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Enviada em</dt>
            <dd className="font-medium text-foreground">
              {new Date(status.sentAt).toLocaleString("pt-BR")}
            </dd>
          </div>
        )}
        {latestPending && remaining > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Prazo restante</dt>
            <dd className="font-medium text-foreground">{remaining} min</dd>
          </div>
        )}
      </dl>
      <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {(Object.keys(OFFER_STATUS_LABELS) as Array<keyof typeof OFFER_STATUS_LABELS>).map((key) =>
          counts[key as keyof typeof counts] > 0 ? (
            <li key={key} className="flex justify-between">
              <span>{OFFER_STATUS_LABELS[key]}</span>
              <span className="font-medium text-foreground">{counts[key as keyof typeof counts]}</span>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}

export function DispatchPanel({ order, onSent }: { order: any; onSent: () => void }) {
  const dispatchAuto = useServerFn(dispatchOrderToEligibleDrivers);
  const dispatchManual = useServerFn(dispatchOrderToDriver);
  const fetchDrivers = useServerFn(listDispatchableDrivers);

  const [mode, setMode] = useState<DispatchMode>("automatic");
  const [price, setPrice] = useState<number>(order.driver_amount ?? 0);
  const [minutes, setMinutes] = useState(15);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const driversQ = useQuery({
    queryKey: ["dispatchable-drivers"],
    queryFn: () => fetchDrivers(),
    enabled: mode === "manual",
  });

  const drivers = useMemo(() => driversQ.data ?? [], [driversQ.data]);
  const filtered = useMemo(() => filterDispatchDrivers(drivers, search), [drivers, search]);
  const selectedDriver = drivers.find((driver) => driver.user_id === selectedDriverId) ?? null;

  if (!["planning", "created", "preparing", "awaiting_driver"].includes(order.status)) {
    return null;
  }

  async function send() {
    setSending(true);
    try {
      if (mode === "automatic") {
        const result = await dispatchAuto({ data: { order_id: order.id, price, minutes } });
        if (result.count === 0) {
          toast.warning("Nenhum motorista cadastrado para receber a oferta.");
          return;
        }
        toast.success(`Oferta enviada para ${result.count} motorista(s).`);
      } else {
        if (!selectedDriverId) {
          toast.warning("Selecione um motorista para enviar a oferta.");
          return;
        }
        await dispatchManual({ data: { order_id: order.id, driver_id: selectedDriverId, price, minutes } });
        toast.success(`Oferta enviada para ${selectedDriver?.full_name ?? "o motorista selecionado"}.`);
      }
      setConfirming(false);
      setRefreshKey((key) => key + 1);
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao despachar rota");
    } finally {
      setSending(false);
    }
  }

  const canDispatch = mode === "automatic" || !!selectedDriverId;

  return (
    <>
      <section className="card-soft p-6">
        <header className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Despacho de frete
          </h2>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modalidade de despacho">
          {(["automatic", "manual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              onClick={() => { setMode(option); setConfirming(false); }}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors",
                mode === option
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "automatic" ? <Users className="h-4 w-4 shrink-0" /> : <UserCheck className="h-4 w-4 shrink-0" />}
              {DISPATCH_MODE_LABELS[option]}
            </button>
          ))}
        </div>

        {mode === "automatic" ? (
          <p className="mb-4 text-sm text-muted-foreground">
            A oferta será enviada simultaneamente a todos os motoristas aprovados e elegíveis.
            O primeiro que aceitar fica responsável pelo frete.
          </p>
        ) : (
          <div className="mb-4">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, telefone, placa ou veículo"
                className="pl-9"
                aria-label="Buscar motorista"
              />
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-1">
              {driversQ.isLoading && (
                <li className="p-3 text-sm text-muted-foreground">Carregando motoristas…</li>
              )}
              {driversQ.isError && (
                <li className="p-3 text-sm text-destructive">Não foi possível carregar os motoristas.</li>
              )}
              {!driversQ.isLoading && !driversQ.isError && filtered.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">Nenhum motorista encontrado.</li>
              )}
              {filtered.map((driver) => (
                <li key={driver.user_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDriverId(driver.user_id)}
                    aria-pressed={selectedDriverId === driver.user_id}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                      selectedDriverId === driver.user_id ? "bg-primary/10" : "hover:bg-surface-2",
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      {driver.photo_url && <AvatarImage src={driver.photo_url} alt="" />}
                      <AvatarFallback>{(driver.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {driver.full_name ?? "Motorista"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[driver.vehicle_type, driver.vehicle_model, driver.vehicle_plate]
                          .filter(Boolean)
                          .join(" · ") || "Veículo não informado"}
                        {driver.vehicle_capacity_kg ? ` · ${driver.vehicle_capacity_kg} kg` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {availabilityLabel(driver.availability)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">
            Valor ao motorista (R$)
            <input
              type="number"
              min="0"
              value={price}
              onChange={(event) => setPrice(Number(event.target.value))}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Prazo para aceite (min)
            <input
              type="number"
              min="1"
              max="1440"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none"
            />
          </label>
        </div>

        {confirming ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-foreground">
              {mode === "automatic"
                ? "Confirmar o envio da oferta para todos os motoristas elegíveis?"
                : `Confirmar o envio da oferta somente para ${selectedDriver?.full_name ?? "o motorista selecionado"}?`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={send} disabled={sending}>
                <Send className="h-4 w-4" />
                {sending ? "Enviando…" : "Confirmar envio"}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)} disabled={!canDispatch} className="w-full">
            <Send className="h-4 w-4" />
            {mode === "automatic" ? "Despachar para todos" : "Enviar oferta ao motorista"}
          </Button>
        )}
      </section>

      <DispatchStatus orderId={order.id} refreshKey={refreshKey} />
    </>
  );
}
