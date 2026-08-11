import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Upload, X, Copy, MessageCircle, Mail, MapPin } from "lucide-react";
import QRCode from "qrcode";
import { shareMessage, trackingUrl } from "@/lib/order-status";
import { MapboxAutocomplete, type MapboxLocation } from "@/components/mapbox-autocomplete";

const MAPBOX_TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;

export const Route = createFileRoute("/_authenticated/ops/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo frete — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: NewOrderWizard,
});

type Form = {
  // 1 Cliente
  client_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  company: string;
  purchase_order: string;
  order_number: string;
  client_notes: string;
  // 2 Coleta
  pickup_company: string;
  pickup_contact: string;
  pickup_phone: string;
  pickup_whatsapp: string;
  origin_address: string;
  origin_city: string;
  origin_state: string;
  origin_zip: string;
  origin_neighborhood: string;
  origin_number: string;
  origin_lat: string;
  origin_lng: string;
  pickup_date: string;
  pickup_time: string;
  pickup_franchise_minutes: string;
  pickup_reference: string;
  pickup_dock: string;
  pickup_gate: string;
  pickup_instructions: string;
  // 3 Entrega
  delivery_company: string;
  delivery_contact: string;
  delivery_phone: string;
  delivery_whatsapp: string;
  destination_address: string;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  destination_neighborhood: string;
  destination_number: string;
  destination_lat: string;
  destination_lng: string;
  delivery_date: string;
  delivery_time: string;
  delivery_franchise_minutes: string;
  delivery_reference: string;
  delivery_dock: string;
  delivery_gate: string;
  // 4 Carga
  cargo_weight_kg: string;
  volumes: string;
  cargo_volume_m3: string;
  cargo_type: string;
  cargo_description: string;
  invoice_value: string;
  invoice_number: string;
  cte_number: string;
  mdfe_number: string;
  cargo_notes: string;
  // 5 Custos
  price: string;
  driver_price: string;
  toll: string;
  fuel: string;
  escort: string;
  license: string;
  other_costs: string;
  priority: string;
};

const EMPTY: Form = {
  client_name: "", contact_name: "", contact_phone: "", contact_email: "", company: "",
  purchase_order: "", order_number: "", client_notes: "",
  pickup_company: "", pickup_contact: "", pickup_phone: "", pickup_whatsapp: "",
  origin_address: "", origin_city: "", origin_state: "", origin_zip: "",
  origin_neighborhood: "", origin_number: "", origin_lat: "", origin_lng: "",
  pickup_date: "", pickup_time: "", pickup_franchise_minutes: "",
  pickup_reference: "", pickup_dock: "", pickup_gate: "", pickup_instructions: "",
  delivery_company: "", delivery_contact: "", delivery_phone: "", delivery_whatsapp: "",
  destination_address: "", destination_city: "", destination_state: "", destination_zip: "",
  destination_neighborhood: "", destination_number: "", destination_lat: "", destination_lng: "",
  delivery_date: "", delivery_time: "", delivery_franchise_minutes: "",
  delivery_reference: "", delivery_dock: "", delivery_gate: "",
  cargo_weight_kg: "", volumes: "", cargo_volume_m3: "", cargo_type: "",
  cargo_description: "", invoice_value: "", invoice_number: "", cte_number: "", mdfe_number: "",
  cargo_notes: "",
  price: "", driver_price: "", toll: "", fuel: "", escort: "", license: "", other_costs: "",
  priority: "normal",
};

const STEPS = ["Cliente", "Coleta", "Entrega", "Carga", "Custos", "Documentos"] as const;

function combineDateTime(d: string, t: string): string | null {
  if (!d) return null;
  const iso = t ? `${d}T${t}:00` : `${d}T00:00:00`;
  return new Date(iso).toISOString();
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
}

function NewOrderWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [files, setFiles] = useState<{ file: File; kind: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<{ id: string; company_name: string; cnpj: string; full_name: string; phone: string; whatsapp: string; email: string; zip_code: string; address: string; address_number: string; neighborhood: string; city: string; state: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [result, setResult] = useState<{
    id: string;
    code: string;
    tracking_code: string;
    qr: string;
  } | null>(null);

  function set<K extends keyof Form>(k: K, v: string) { setF((s) => ({ ...s, [k]: v })); }

  useEffect(() => {
    async function loadClients() {
      try {
        // Fetch user IDs that have the 'client' role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "client");

        if (roleError) throw roleError;

        // If no clients found by role, fall back to fetching all profiles
        // This is important because the 'client' user role might not be set for all existing clients
        if (!roleData || roleData.length === 0) {
          console.warn("Nenhum usuário com papel 'client' encontrado. Buscando todos os perfis.");
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, company_name, cnpj, full_name, phone, whatsapp, zip_code, address_number, neighborhood, city, state")
            .limit(100);
          
          if (profilesError) throw profilesError;
          if (profilesData) setClients(profilesData as any);
          return;
        }

        const clientIds = roleData.map(r => r.user_id);

        // Fetch profiles for those IDs
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, company_name, cnpj, full_name, phone, whatsapp, zip_code, address_number, neighborhood, city, state")
          .in("id", clientIds);
        
        if (profilesError) throw profilesError;
        if (profilesData) setClients(profilesData as any);
      } catch (err) {
        console.error("Erro ao carregar clientes:", err);
        // Last resort: fetch anything from profiles to not leave the list empty
        const { data } = await supabase.from("profiles").select("id, company_name, full_name").limit(10);
        if (data) setClients(data as any);
      }
    }
    loadClients();
  }, []);

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setF(s => ({
        ...s,
        client_name: client.full_name || "",
        company: client.company_name || "",
        contact_name: client.full_name || "",
        contact_phone: client.phone || "",
        contact_email: "", // email is not in profiles by default, would need auth.users join
        client_notes: `CNPJ: ${client.cnpj || ""}\nWhatsApp: ${client.whatsapp || ""}`,
        origin_address: "", // Address fields
        origin_city: client.city || "",
        origin_state: client.state || "",
        origin_zip: client.zip_code || "",
        origin_neighborhood: client.neighborhood || "",
        origin_number: client.address_number || "",
      }));
    }
  }

  const totalCost = ["driver_price", "toll", "fuel", "escort", "license", "other_costs"]
    .reduce((s, k) => s + (num(f[k as keyof Form] as string) ?? 0), 0);
  const revenue = num(f.price) ?? 0;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  function canAdvance(): string | null {
    if (step === 0 && !f.client_name.trim()) return "Informe o nome do cliente";
    if (step === 1 && !f.origin_address.trim()) return "Informe o endereço de coleta";
    if (step === 2 && !f.destination_address.trim()) return "Informe o endereço de entrega";
    if (step === 4 && !f.price) return "Informe o valor negociado com o cliente";
    return null;
  }

  const [routeInfo, setRouteInfo] = useState<{
    distance_km: number;
    duration_minutes: number;
    geometry: string;
  } | null>(null);

  useEffect(() => {
    async function calc() {
      if (f.origin_lat && f.origin_lng && f.destination_lat && f.destination_lng && MAPBOX_TOKEN) {
        try {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${f.origin_lng},${f.origin_lat};${f.destination_lng},${f.destination_lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
          const res = await fetch(url);
          const data = await res.json();
          const route = data.routes?.[0];
          if (route) {
            setRouteInfo({
              distance_km: Number((route.distance / 1000).toFixed(1)),
              duration_minutes: Math.round(route.duration / 60),
              geometry: JSON.stringify(route.geometry),
            });
            // Auto fill price/tolls if needed, but usually operators do this
          }
        } catch (e) {
          console.error("Route calc error:", e);
        }
      }
    }
    calc();
  }, [f.origin_lat, f.origin_lng, f.destination_lat, f.destination_lng]);

  function handleLocationSelect(type: "origin" | "destination", loc: MapboxLocation) {
    if (type === "origin") {
      setF(s => ({
        ...s,
        origin_address: loc.address,
        origin_city: loc.city,
        origin_state: loc.state,
        origin_zip: loc.zip,
        origin_neighborhood: loc.neighborhood,
        origin_number: loc.number,
        origin_lat: String(loc.lat),
        origin_lng: String(loc.lng),
      }));
    } else {
      setF(s => ({
        ...s,
        destination_address: loc.address,
        destination_city: loc.city,
        destination_state: loc.state,
        destination_zip: loc.zip,
        destination_neighborhood: loc.neighborhood,
        destination_number: loc.number,
        destination_lat: String(loc.lat),
        destination_lng: String(loc.lng),
      }));
    }
  }

  function next() {
    const err = canAdvance();
    if (err) return toast.error(err);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  async function save() {
    const err = canAdvance();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        client_id: selectedClientId || null,
        client_name: f.client_name || null,
        contact_name: f.contact_name || null,
        contact_phone: f.contact_phone || null,
        origin_address: f.origin_address,
        origin_city: f.origin_city || null,
        origin_state: f.origin_state || null,
        origin_zip: f.origin_zip || null,
        origin_neighborhood: f.origin_neighborhood || null,
        origin_number: f.origin_number || null,
        origin_lat: num(f.origin_lat),
        origin_lng: num(f.origin_lng),
        destination_address: f.destination_address,
        destination_city: f.destination_city || null,
        destination_state: f.destination_state || null,
        destination_zip: f.destination_zip || null,
        destination_neighborhood: f.destination_neighborhood || null,
        destination_number: f.destination_number || null,
        destination_lat: num(f.destination_lat),
        destination_lng: num(f.destination_lng),
        pickup_reference: f.pickup_reference || null,
        pickup_dock: f.pickup_dock || null,
        pickup_gate: f.pickup_gate || null,
        pickup_instructions: f.pickup_instructions || null,
        delivery_reference: f.delivery_reference || null,
        delivery_dock: f.delivery_dock || null,
        delivery_gate: f.delivery_gate || null,
        cargo_description: f.cargo_description || null,
        cargo_weight_kg: num(f.cargo_weight_kg),
        cargo_volume_m3: num(f.cargo_volume_m3),
        cargo_value: num(f.invoice_value),
        cargo_value_declared: num(f.invoice_value),
        invoice_value: num(f.invoice_value),
        invoice_number: f.invoice_number || null,
        cte_number: f.cte_number || null,
        mdfe_number: f.mdfe_number || null,
        volumes: f.volumes ? Number(f.volumes) : null,
        cargo_type: f.cargo_type || null,
        price: num(f.price),
        pickup_window_start: combineDateTime(f.pickup_date, f.pickup_time),
        pickup_window_end: combineDateTime(f.pickup_date, f.pickup_time),
        delivery_window_start: combineDateTime(f.delivery_date, f.delivery_time),
        delivery_window_end: combineDateTime(f.delivery_date, f.delivery_time),
        pickup_franchise_minutes: f.pickup_franchise_minutes ? Number(f.pickup_franchise_minutes) : null,
        delivery_franchise_minutes: f.delivery_franchise_minutes ? Number(f.delivery_franchise_minutes) : null,
        priority: f.priority,
        notes: [f.client_notes, f.cargo_notes].filter(Boolean).join("\n\n") || null,
        status: "preparing" as const,
        created_by: u.user?.id ?? null,
        distance_km: routeInfo?.distance_km ?? null,
        estimated_minutes: routeInfo?.duration_minutes ?? null,
        route_geometry: routeInfo?.geometry ?? null,
        estimated_tolls: num(f.toll),
      };
      const { data: order, error } = await supabase
        .from("orders").insert(payload).select("id, code, tracking_code").single();
      if (error) throw error;

      // Espera a PF ser criada pelo trigger e grava custos
      const program = await supabase
        .from("freight_programs").select("id").eq("order_id", order.id).maybeSingle();
      if (program.data) {
        const costs = [
          { kind: "frete", amount: num(f.driver_price) },
          { kind: "pedagio", amount: num(f.toll) },
          { kind: "combustivel", amount: num(f.fuel) },
          { kind: "escolta", amount: num(f.escort) },
          { kind: "licenca", amount: num(f.license) },
          { kind: "outros", amount: num(f.other_costs) },
        ].filter((c) => c.amount != null && c.amount > 0)
         .map((c) => ({ program_id: program.data!.id, kind: c.kind, amount: c.amount }));
        if (costs.length) await supabase.from("freight_costs").insert(costs as never);
        if (num(f.driver_price)) {
          await supabase.from("freight_programs")
            .update({ freight_value: num(f.driver_price) })
            .eq("id", program.data.id);
        }
      }

      // Upload de anexos
      for (const it of files) {
        const path = `${order.id}/${Date.now()}-${it.file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("order-files").upload(path, it.file, {
          upsert: false, contentType: it.file.type,
        });
        if (up.error) continue;
        await supabase.from("order_attachments").insert({
          order_id: order.id, kind: it.kind, label: it.file.name,
          file_path: path, mime_type: it.file.type, size_bytes: it.file.size,
          uploaded_by: u.user?.id ?? null,
        });
      }

      await supabase.from("order_events").insert({
        order_id: order.id, event_type: "order_created",
        to_status: "preparing", actor_id: u.user?.id ?? null,
      });

      const qr = await QRCode.toDataURL(trackingUrl(order.tracking_code), { margin: 1, width: 220 });
      setResult({ id: order.id, code: order.code, tracking_code: order.tracking_code, qr });
      toast.success(`Frete ${order.code} cadastrado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar frete");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const link = trackingUrl(result.tracking_code);
    const msg = shareMessage(result.tracking_code);
    return (
      <AppShell title="Frete criado" subtitle={`${result.code} · rastreio ${result.tracking_code}`}>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="card-soft p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">Pronto para despachar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compartilhe o rastreio com o cliente ou envie oferta agora.</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <img src={result.qr} alt="QR Code" className="rounded-2xl border border-border p-3" />
              <div className="font-mono text-sm">{result.tracking_code}</div>
              <div className="break-all text-xs text-muted-foreground">{link}</div>
            </div>

            {routeInfo && (
              <div className="mt-6 border-y border-border py-6 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 mt-1">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <div className="h-10 w-px bg-border" />
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coleta</div>
                      <div className="font-semibold text-sm">{f.pickup_company || "Empresa"} · {f.origin_city}/{f.origin_state}</div>
                      <div className="text-xs text-muted-foreground">{f.pickup_date} às {f.pickup_time}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entrega</div>
                      <div className="font-semibold text-sm">{f.delivery_company || "Empresa"} · {f.destination_city}/{f.destination_state}</div>
                      <div className="text-xs text-muted-foreground">{f.delivery_date} às {f.delivery_time}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-around rounded-xl bg-surface-2 p-3 text-center">
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Distância</div>
                    <div className="text-sm font-bold">{routeInfo.distance_km} km</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Tempo</div>
                    <div className="text-sm font-bold">{Math.floor(routeInfo.duration_minutes / 60)}h{routeInfo.duration_minutes % 60}m</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Pedágios</div>
                    <div className="text-sm font-bold">{brl(num(f.toll) || 0)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent">
                <Copy className="h-4 w-4" /> Copiar link
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <a href={`mailto:?subject=Rastreio do seu frete&body=${encodeURIComponent(msg)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent">
                <Mail className="h-4 w-4" /> E-mail
              </a>
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to="/ops/pedidos/$id" params={{ id: result.id }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                Despachar agora <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ops"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-2.5 text-sm font-semibold hover:bg-accent">
                Voltar ao dashboard
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Novo frete"
      subtitle={`Etapa ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}
      actions={
        <Link to="/ops" className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : null)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                i === step
                  ? "bg-brand text-brand-foreground"
                  : i < step
                    ? "bg-brand/10 text-brand hover:bg-brand/20"
                    : "bg-surface-2 text-muted-foreground"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="text-muted-foreground/40">›</span>}
          </li>
        ))}
      </ol>

      <div className="card-soft p-6 sm:p-8">
        {step === 0 && (
          <Grid>
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Selecionar Cliente Cadastrado
                </span>
                <select 
                  value={selectedClientId} 
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand appearance-none"
                >
                  <option value="">— Selecionar Cliente (Opcional) —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.full_name || "Sem Nome"} {c.cnpj ? `(${c.cnpj})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <T label="Nome do Cliente" required value={f.client_name} onChange={(v) => set("client_name", v)} />
            <T label="Empresa" value={f.company} onChange={(v) => set("company", v)} />
            <T label="Contato" value={f.contact_name} onChange={(v) => set("contact_name", v)} />
            <T label="Telefone" value={f.contact_phone} onChange={(v) => set("contact_phone", v)} />
            <T label="E-mail" type="email" value={f.contact_email} onChange={(v) => set("contact_email", v)} />
            <T label="Ordem de compra (OC)" value={f.purchase_order} onChange={(v) => set("purchase_order", v)} />
            <T label="Nº do pedido" value={f.order_number} onChange={(v) => set("order_number", v)} />
            <T label="Observações" value={f.client_notes} onChange={(v) => set("client_notes", v)} full />
          </Grid>
        )}

        {step === 1 && (
          <Grid>
            <T label="Empresa da coleta" value={f.pickup_company} onChange={(v) => set("pickup_company", v)} />
            <T label="Responsável" value={f.pickup_contact} onChange={(v) => set("pickup_contact", v)} />
            <T label="WhatsApp" value={f.pickup_whatsapp} onChange={(v) => set("pickup_whatsapp", v)} />
            <div className="sm:col-span-2">
              <MapboxAutocomplete
                label="Endereço de coleta"
                required
                value={f.origin_address}
                onChange={(v) => set("origin_address", v)}
                onSelect={(loc) => handleLocationSelect("origin", loc)}
              />
            </div>
            <T label="Número" value={f.origin_number} onChange={(v) => set("origin_number", v)} />
            <T label="Bairro" value={f.origin_neighborhood} onChange={(v) => set("origin_neighborhood", v)} />
            <T label="Cidade" value={f.origin_city} onChange={(v) => set("origin_city", v)} />
            <T label="UF" value={f.origin_state} onChange={(v) => set("origin_state", v)} />
            <T label="Data da coleta" type="date" value={f.pickup_date} onChange={(v) => set("pickup_date", v)} />
            <T label="Hora" type="time" value={f.pickup_time} onChange={(v) => set("pickup_time", v)} />
            <T label="Referência" value={f.pickup_reference} onChange={(v) => set("pickup_reference", v)} />
            <T label="Doca" value={f.pickup_dock} onChange={(v) => set("pickup_dock", v)} />
            <T label="Portaria" value={f.pickup_gate} onChange={(v) => set("pickup_gate", v)} />
            <T label="Instruções" value={f.pickup_instructions} onChange={(v) => set("pickup_instructions", v)} full />
          </Grid>
        )}

        {step === 2 && (
          <Grid>
            <T label="Empresa da entrega" value={f.delivery_company} onChange={(v) => set("delivery_company", v)} />
            <T label="Responsável" value={f.delivery_contact} onChange={(v) => set("delivery_contact", v)} />
            <T label="WhatsApp" value={f.delivery_whatsapp} onChange={(v) => set("delivery_whatsapp", v)} />
            <div className="sm:col-span-2">
              <MapboxAutocomplete
                label="Endereço de entrega"
                required
                value={f.destination_address}
                onChange={(v) => set("destination_address", v)}
                onSelect={(loc) => handleLocationSelect("destination", loc)}
              />
            </div>
            <T label="Número" value={f.destination_number} onChange={(v) => set("destination_number", v)} />
            <T label="Bairro" value={f.destination_neighborhood} onChange={(v) => set("destination_neighborhood", v)} />
            <T label="Cidade" value={f.destination_city} onChange={(v) => set("destination_city", v)} />
            <T label="UF" value={f.destination_state} onChange={(v) => set("destination_state", v)} />
            <T label="Data prevista" type="date" value={f.delivery_date} onChange={(v) => set("delivery_date", v)} />
            <T label="Hora prevista" type="time" value={f.delivery_time} onChange={(v) => set("delivery_time", v)} />
            <T label="Referência" value={f.delivery_reference} onChange={(v) => set("delivery_reference", v)} />
            <T label="Doca" value={f.delivery_dock} onChange={(v) => set("delivery_dock", v)} />
            <T label="Portaria" value={f.delivery_gate} onChange={(v) => set("delivery_gate", v)} />
          </Grid>
        )}

        {step === 3 && (
          <Grid>
            <T label="Peso (kg)" type="number" value={f.cargo_weight_kg} onChange={(v) => set("cargo_weight_kg", v)} />
            <T label="Volumes" type="number" value={f.volumes} onChange={(v) => set("volumes", v)} />
            <T label="Cubagem (m³)" type="number" value={f.cargo_volume_m3} onChange={(v) => set("cargo_volume_m3", v)} />
            <T label="Tipo" value={f.cargo_type} onChange={(v) => set("cargo_type", v)} />
            <T label="Produto" value={f.cargo_description} onChange={(v) => set("cargo_description", v)} full />
            <T label="Valor da nota fiscal" type="number" value={f.invoice_value} onChange={(v) => set("invoice_value", v)} />
            <T label="Nº da nota fiscal" value={f.invoice_number} onChange={(v) => set("invoice_number", v)} />
            <T label="CT-e" value={f.cte_number} onChange={(v) => set("cte_number", v)} />
            <T label="MDF-e" value={f.mdfe_number} onChange={(v) => set("mdfe_number", v)} />
            <T label="Observações" value={f.cargo_notes} onChange={(v) => set("cargo_notes", v)} full />
          </Grid>
        )}

        {step === 4 && (
          <>
            <Grid>
              <T label="Valor negociado com cliente (R$)" required type="number" value={f.price} onChange={(v) => set("price", v)} />
              <T label="Valor do motorista (R$)" type="number" value={f.driver_price} onChange={(v) => set("driver_price", v)} />
              <T label="Pedágio (R$)" type="number" value={f.toll} onChange={(v) => set("toll", v)} />
              <T label="Combustível (R$)" type="number" value={f.fuel} onChange={(v) => set("fuel", v)} />
              <T label="Escolta (R$)" type="number" value={f.escort} onChange={(v) => set("escort", v)} />
              <T label="Licença (R$)" type="number" value={f.license} onChange={(v) => set("license", v)} />
              <T label="Outros custos (R$)" type="number" value={f.other_costs} onChange={(v) => set("other_costs", v)} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Prioridade</span>
                <select value={f.priority} onChange={(e) => set("priority", e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
            </Grid>
            {routeInfo && (
              <div className="mt-6 mb-6 p-6 rounded-2xl bg-brand/5 border border-brand/10">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand mb-4">Resumo da Rota</div>
                <div className="grid gap-6 sm:grid-cols-4">
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Distância</div>
                    <div className="text-xl font-bold">{routeInfo.distance_km} km</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Tempo</div>
                    <div className="text-xl font-bold">{Math.floor(routeInfo.duration_minutes / 60)}h {routeInfo.duration_minutes % 60}m</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Trajeto</div>
                    <div className="text-sm font-medium mt-1 truncate">
                      {f.origin_city} ({f.origin_state}) → {f.destination_city} ({f.destination_state})
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <KPI label="Custo total" value={brl(totalCost)} />
              <KPI label="Lucro previsto" value={brl(profit)} tone={profit >= 0 ? "positive" : "negative"} />
              <KPI label="Margem" value={`${margin.toFixed(1)}%`} tone={margin >= 15 ? "positive" : margin >= 0 ? "neutral" : "negative"} />
            </div>
          </>
        )}

        {step === 5 && (
          <div>
            <p className="text-sm text-muted-foreground">Anexe NF, CT-e, MDF-e, XML, fotos, PDF ou vídeos. Os arquivos ficam vinculados ao frete.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2 px-6 py-10 hover:bg-accent">
              <Upload className="h-5 w-5 text-brand" />
              <span className="text-sm font-medium">Selecionar arquivos</span>
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...list.map((file) => ({ file, kind: guessKind(file.name) }))]);
                  e.target.value = "";
                }}
              />
            </label>
            <ul className="mt-4 divide-y divide-border">
              {files.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.file.name}</div>
                    <div className="text-xs text-muted-foreground">{(it.file.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <select
                    value={it.kind}
                    onChange={(e) => setFiles((prev) => prev.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                    className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
                  >
                    <option value="nota_fiscal">NF</option>
                    <option value="cte">CT-e</option>
                    <option value="mdfe">MDF-e</option>
                    <option value="xml">XML</option>
                    <option value="foto">Foto</option>
                    <option value="pdf">PDF</option>
                    <option value="video">Vídeo</option>
                    <option value="outro">Outro</option>
                  </select>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {files.length === 0 && <li className="py-4 text-sm text-muted-foreground">Nenhum arquivo selecionado (opcional).</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button onClick={prev} disabled={step === 0}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={next}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
            Avançar <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
            <Check className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar frete"}
          </button>
        )}
      </div>
    </AppShell>
  );
}

function guessKind(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["xml"].includes(ext)) return "xml";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) return "foto";
  if (["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
  return "outro";
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function T({
  label, value, onChange, required, type = "text", full,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

function KPI({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  const cls =
    tone === "positive" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "negative" ? "bg-red-50 text-red-700 border-red-200"
    : "bg-surface-2 text-foreground border-border";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
