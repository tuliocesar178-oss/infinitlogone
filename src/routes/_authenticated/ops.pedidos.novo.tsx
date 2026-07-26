import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ops/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: NewOrder,
});

function NewOrder() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    client_name: "",
    contact_name: "",
    contact_phone: "",
    origin_address: "",
    origin_city: "",
    destination_address: "",
    destination_city: "",
    cargo_description: "",
    cargo_weight_kg: "",
    cargo_value: "",
    volumes: "",
    cargo_type: "",
    price: "",
    pickup_window_start: "",
    pickup_window_end: "",
    delivery_window_start: "",
    delivery_window_end: "",
    priority: "normal",
    notes: "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        client_name: f.client_name || null,
        contact_name: f.contact_name || null,
        contact_phone: f.contact_phone || null,
        origin_address: f.origin_address,
        origin_city: f.origin_city || null,
        destination_address: f.destination_address,
        destination_city: f.destination_city || null,
        cargo_description: f.cargo_description || null,
        cargo_weight_kg: f.cargo_weight_kg ? Number(f.cargo_weight_kg) : null,
        cargo_value: f.cargo_value ? Number(f.cargo_value) : null,
        volumes: f.volumes ? Number(f.volumes) : null,
        cargo_type: f.cargo_type || null,
        price: f.price ? Number(f.price) : null,
        pickup_window_start: f.pickup_window_start || null,
        pickup_window_end: f.pickup_window_end || null,
        delivery_window_start: f.delivery_window_start || null,
        delivery_window_end: f.delivery_window_end || null,
        priority: f.priority,
        notes: f.notes || null,
        status: "preparing" as const,
        created_by: u.user?.id ?? null,
      };
      const { data, error } = await supabase.from("orders").insert(payload).select("id, code").single();
      if (error) throw error;
      await supabase.from("order_events").insert({
        order_id: data.id,
        event_type: "order_created",
        to_status: "preparing",
        actor_id: u.user?.id ?? null,
      });
      toast.success(`Pedido ${data.code} criado`);
      navigate({ to: "/ops/pedidos/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar pedido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Novo pedido"
      subtitle="Cadastre os dados do frete negociado com o cliente."
      actions={
        <Link
          to="/ops"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-6">
        <Section title="Cliente e contato">
          <Grid>
            <Text label="Cliente" required value={f.client_name} onChange={(v) => set("client_name", v)} />
            <Text label="Contato" value={f.contact_name} onChange={(v) => set("contact_name", v)} />
            <Text label="Telefone" value={f.contact_phone} onChange={(v) => set("contact_phone", v)} />
          </Grid>
        </Section>

        <Section title="Coleta">
          <Grid>
            <Text
              label="Endereço completo da coleta"
              required
              value={f.origin_address}
              onChange={(v) => set("origin_address", v)}
              full
            />
            <Text label="Cidade de origem" value={f.origin_city} onChange={(v) => set("origin_city", v)} />
            <Text
              label="Janela — início"
              type="datetime-local"
              value={f.pickup_window_start}
              onChange={(v) => set("pickup_window_start", v)}
            />
            <Text
              label="Janela — fim"
              type="datetime-local"
              value={f.pickup_window_end}
              onChange={(v) => set("pickup_window_end", v)}
            />
          </Grid>
        </Section>

        <Section title="Entrega">
          <Grid>
            <Text
              label="Endereço completo da entrega"
              required
              value={f.destination_address}
              onChange={(v) => set("destination_address", v)}
              full
            />
            <Text label="Cidade de destino" value={f.destination_city} onChange={(v) => set("destination_city", v)} />
            <Text
              label="Janela — início"
              type="datetime-local"
              value={f.delivery_window_start}
              onChange={(v) => set("delivery_window_start", v)}
            />
            <Text
              label="Janela — fim"
              type="datetime-local"
              value={f.delivery_window_end}
              onChange={(v) => set("delivery_window_end", v)}
            />
          </Grid>
        </Section>

        <Section title="Carga">
          <Grid>
            <Text label="Tipo da carga" value={f.cargo_type} onChange={(v) => set("cargo_type", v)} />
            <Text label="Peso (kg)" type="number" value={f.cargo_weight_kg} onChange={(v) => set("cargo_weight_kg", v)} />
            <Text label="Qtd. de volumes" type="number" value={f.volumes} onChange={(v) => set("volumes", v)} />
            <Text label="Valor da carga (R$)" type="number" value={f.cargo_value} onChange={(v) => set("cargo_value", v)} />
            <Text
              label="Descrição da carga"
              value={f.cargo_description}
              onChange={(v) => set("cargo_description", v)}
              full
            />
          </Grid>
        </Section>

        <Section title="Comercial">
          <Grid>
            <Text label="Valor negociado (R$)" type="number" required value={f.price} onChange={(v) => set("price", v)} />
            <Select
              label="Prioridade"
              value={f.priority}
              onChange={(v) => set("priority", v)}
              options={[
                { value: "low", label: "Baixa" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "Alta" },
                { value: "urgent", label: "Urgente" },
              ]}
            />
            <Text label="Observações" value={f.notes} onChange={(v) => set("notes", v)} full />
          </Grid>
        </Section>

        <div className="flex items-center justify-end gap-3">
          <Link
            to="/ops"
            className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar pedido"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-soft p-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  full?: boolean;
}) {
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
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
