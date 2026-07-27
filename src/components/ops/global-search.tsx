import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { MapPin, Package, Search, Truck, User } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const query = q.trim();
  const enabled = query.length >= 2 && open;

  const searchQ = useQuery({
    queryKey: ["global-search", query],
    enabled,
    queryFn: async () => {
      const like = `%${query}%`;
      const [orders, drivers, vehicles] = await Promise.all([
        supabase
          .from("orders")
          .select("id, code, tracking_code, client_name, contact_phone, invoice_number, cte_number, destination_city, origin_city")
          .is("deleted_at", null)
          .or(
            `code.ilike.${like},tracking_code.ilike.${like},client_name.ilike.${like},contact_phone.ilike.${like},invoice_number.ilike.${like},cte_number.ilike.${like},destination_city.ilike.${like},origin_city.ilike.${like}`,
          )
          .limit(8),
        supabase
          .from("drivers")
          .select("user_id, phone, whatsapp, city, email")
          .or(`phone.ilike.${like},whatsapp.ilike.${like},city.ilike.${like},email.ilike.${like}`)
          .limit(6),
        supabase
          .from("vehicles")
          .select("id, plate, model, current_city")
          .or(`plate.ilike.${like},model.ilike.${like},current_city.ilike.${like}`)
          .limit(6),
      ]);
      const driverIds = (drivers.data ?? []).map((d) => d.user_id);
      let profiles = new Map<string, string>();
      if (driverIds.length) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", driverIds);
        for (const p of data ?? []) profiles.set(p.id, p.full_name ?? "");
      }
      return {
        orders: orders.data ?? [],
        drivers: (drivers.data ?? []).map((d) => ({ ...d, name: profiles.get(d.user_id) ?? d.email })),
        vehicles: vehicles.data ?? [],
      };
    },
  });

  function go(fn: () => void) {
    setOpen(false);
    setQ("");
    fn();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Buscar pedido, motorista, placa, NF…</span>
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar em toda a operação…" value={q} onValueChange={setQ} />
        <CommandList>
          {!enabled && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Digite ao menos 2 caracteres. Pesquise por código, cliente, placa, telefone, cidade, NF ou CT-e.
            </div>
          )}
          {enabled && !searchQ.isLoading && <CommandEmpty>Nada encontrado.</CommandEmpty>}
          {enabled && searchQ.data?.orders?.length ? (
            <CommandGroup heading="Fretes">
              {searchQ.data.orders.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`o-${o.id}`}
                  onSelect={() => go(() => navigate({ to: "/ops/pedidos/$id", params: { id: o.id } }))}
                >
                  <Package className="h-4 w-4 text-brand" />
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">{o.code}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {o.client_name ?? "—"} · {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {enabled && searchQ.data?.drivers?.length ? (
            <CommandGroup heading="Motoristas">
              {searchQ.data.drivers.map((d) => (
                <CommandItem
                  key={d.user_id}
                  value={`d-${d.user_id}`}
                  onSelect={() => go(() => navigate({ to: "/ops/motoristas/$id", params: { id: d.user_id } }))}
                >
                  <User className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">{d.name || d.email}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {d.city ?? d.phone ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {enabled && searchQ.data?.vehicles?.length ? (
            <CommandGroup heading="Veículos">
              {searchQ.data.vehicles.map((v) => (
                <CommandItem
                  key={v.id}
                  value={`v-${v.id}`}
                  onSelect={() => go(() => navigate({ to: "/ops/veiculos/$id", params: { id: v.id } }))}
                >
                  <Truck className="h-4 w-4 text-violet-600" />
                  <span className="font-mono text-sm font-semibold">{v.plate}</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {v.current_city ?? v.model ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
