import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Send, Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { dispatchOrderToEligibleDrivers } from "@/lib/dispatch.functions";

type DispatchMode = "automatic" | "manual";

export function DispatchPanel({ order, onSent }: { order: any; onSent: () => void }) {
  const dispatch = useServerFn(dispatchOrderToEligibleDrivers);
  const [price, setPrice] = useState<number>(order.driver_amount ?? 0);
  const [minutes, setMinutes] = useState(15);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<DispatchMode>("automatic");
  const [driverId, setDriverId] = useState("");
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const driversQuery = useQuery({
    queryKey: ["dispatch-eligible-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("user_id,full_name,photo_url,phone,availability,approval_status,deleted_at,current_vehicle_id,vehicles:vehicles!drivers_current_vehicle_id_fkey(vehicle_type,brand,model,plate,capacity_kg)")
        .eq("approval_status", "active")
        .is("deleted_at", null)
        .in("availability", ["disponivel", "em_frete"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredDrivers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (driversQuery.data ?? []).filter((driver: any) => {
      const vehicle = Array.isArray(driver.vehicles) ? driver.vehicles[0] : driver.vehicles;
      const searchable = [
        driver.full_name,
        driver.phone,
        vehicle?.plate,
        vehicle?.vehicle_type,
        vehicle?.brand,
        vehicle?.model,
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return !term || searchable.includes(term);
    });
  }, [driversQuery.data, search]);

  const selectedDriver = (driversQuery.data ?? []).find((driver: any) => driver.user_id === driverId) as any;
  const automaticCount = driversQuery.data?.length ?? 0;

  async function send() {
    setSending(true);
    try {
      const result = await dispatch({
        data: {
          order_id: order.id,
          price,
          minutes,
          mode,
          driver_id: mode === "manual" ? driverId : undefined,
        },
      });

      if (result.count === 0) {
        toast.warning("Nenhum motorista elegível disponível para receber a oferta.");
        return;
      }

      toast.success(
        mode === "manual"
          ? "Oferta enviada somente ao motorista selecionado."
          : `Rota despachada para ${result.count} motorista(s).`,
      );
      setConfirmOpen(false);
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao despachar rota");
    } finally {
      setSending(false);
    }
  }

  if (order.status !== "preparing" && order.status !== "created" && order.status !== "awaiting_driver") {
    return null;
  }

  return (
    <section className="card-soft p-6">
      <header className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Despacho de frete
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha como enviar a oferta aos motoristas elegíveis.
        </p>
      </header>

      <RadioGroup
        value={mode}
        onValueChange={(value) => setMode(value as DispatchMode)}
        className="mb-4 grid gap-2"
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <RadioGroupItem value="automatic" aria-label="Automático — Todos os motoristas" />
          <span>
            <span className="block text-sm font-semibold">Automático — Todos os motoristas</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Enviar simultaneamente para os motoristas aprovados e disponíveis.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <RadioGroupItem value="manual" aria-label="Manual — Escolher motorista" />
          <span>
            <span className="block text-sm font-semibold">Manual — Escolher motorista</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Selecione uma única pessoa para receber a oferta.
            </span>
          </span>
        </label>
      </RadioGroup>

      {mode === "automatic" ? (
        <p className="mb-4 rounded-xl bg-surface-2 p-3 text-sm text-muted-foreground">
          {driversQuery.isLoading
            ? "Consultando motoristas disponíveis…"
            : `${automaticCount} motorista(s) aprovado(s) e disponível(is) poderão receber a oferta.`}
        </p>
      ) : (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar nome, telefone, placa ou veículo"
              className="pl-9"
              aria-label="Pesquisar motoristas"
            />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {driversQuery.isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando motoristas…</p>}
            {driversQuery.isError && <p className="p-3 text-sm text-destructive">Não foi possível carregar os motoristas.</p>}
            {!driversQuery.isLoading && !driversQuery.isError && filteredDrivers.map((driver: any) => {
              const vehicle = Array.isArray(driver.vehicles) ? driver.vehicles[0] : driver.vehicles;
              const selected = driverId === driver.user_id;
              return (
                <button
                  key={driver.user_id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDriverId(driver.user_id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-accent"}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={driver.photo_url ?? undefined} alt="" />
                    <AvatarFallback><UserRound className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{driver.full_name || "Motorista"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {driver.phone || "Telefone não informado"}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      <Truck className="mr-1 inline h-3 w-3" />
                      {[vehicle?.vehicle_type, vehicle?.brand, vehicle?.model, vehicle?.plate].filter(Boolean).join(" · ") || "Veículo não informado"}
                      {vehicle?.capacity_kg != null ? ` · ${vehicle.capacity_kg} kg` : ""}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {driver.availability === "disponivel" ? "Disponível" : "Em frete"}
                    </span>
                  </span>
                </button>
              );
            })}
            {!driversQuery.isLoading && !driversQuery.isError && filteredDrivers.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum motorista encontrado.</p>
            )}
          </div>
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

      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={driversQuery.isLoading || sending || (mode === "manual" && !driverId) || (mode === "automatic" && automaticCount === 0)}
        className="w-full"
      >
        <Send className="h-4 w-4" />
        {mode === "manual" ? "Enviar oferta ao motorista" : "Despachar para todos"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar despacho</DialogTitle>
            <DialogDescription>
              {mode === "manual"
                ? `A oferta será enviada somente para ${selectedDriver?.full_name || "o motorista selecionado"}.`
                : `A oferta será enviada simultaneamente para ${automaticCount} motorista(s) elegível(is).`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Prazo para aceite: {minutes} minuto(s). O valor informado é destinado ao motorista.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>Voltar</Button>
            <Button onClick={send} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? "Despachando…" : "Confirmar e enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
