import { loadRegisteredClients } from "@/lib/registered-clients";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { MapboxAutocomplete, type MapboxLocation } from "@/components/mapbox-autocomplete";
import { TripMap } from "@/components/trip-map";
import { WORK_STATUSES, type WorkStatus } from "@/lib/work";
import { ArrowLeft, CalendarDays, MapPin, Save, Target, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/obras/nova")({
  head: () => ({
    meta: [{ title: "Nova obra — InfinitLog" },{name:'description',content:'Cadastro de obra vinculada a cliente INFINITLOG.'},{property:'og:title',content:'Nova obra — InfinitLog'},{property:'og:description',content:'Obras e clientes da operação.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}, { name: "robots", content: "noindex" }],
  }),
  component: NewWork,
});

type Client = {
  id: string;
  company_name: string | null;
  full_name: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
};

type Form = {
  name: string;
  code: string;
  description: string;
  status: WorkStatus;
  clientId: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  responsibleName: string;
  responsiblePhone: string;
  responsibleWhatsapp: string;
  responsibleEmail: string;
  startDate: string;
  expectedEndDate: string;
  allowNewFreights: boolean;
  notes: string;
};

const EMPTY: Form = {
  name: "",
  code: "",
  description: "",
  status: "active",
  clientId: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  latitude: "",
  longitude: "",
  responsibleName: "",
  responsiblePhone: "",
  responsibleWhatsapp: "",
  responsibleEmail: "",
  startDate: "",
  expectedEndDate: "",
  allowNewFreights: true,
  notes: "",
};

function NewWork() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  useEffect(() => {
    void loadClients();
  }, []);

  async function loadClients() {
    setLoadingClients(true);
    try {
      const clientOptions = (await loadRegisteredClients()).map(client => ({id:client.id,company_name:client.company_name,full_name:client.full_name,cnpj:client.cnpj,city:client.city,state:client.state}));

      setClients(clientOptions);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Não foi possível carregar os clientes.");
    } finally {
      setLoadingClients(false);
    }
  }

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (["address", "city", "state", "latitude", "longitude"].includes(String(key))) {
      setLocationConfirmed(false);
    }
  }

  function handleLocation(location: MapboxLocation) {
    setForm((current) => ({
      ...current,
      address: location.address,
      number: location.number,
      neighborhood: location.neighborhood,
      city: location.city,
      state: location.state,
      zipCode: location.zip,
      latitude: String(location.lat),
      longitude: String(location.lng),
    }));
    setLocationConfirmed(false);
  }

  const selectedClient = clients.find((client) => client.id === form.clientId);
  const hasCoordinates = Boolean(form.latitude && form.longitude);

  const addressSummary = useMemo(
    () =>
      [
        [form.address, form.number].filter(Boolean).join(", "),
        form.complement,
        form.neighborhood,
        [form.city, form.state].filter(Boolean).join("/"),
      ]
        .filter(Boolean)
        .join(" · "),
    [form],
  );

  function validate() {
    if (!form.name.trim()) return "Informe o nome da obra.";
    if (!form.clientId) return "Selecione o cliente responsável.";
    if (!form.address.trim()) return "Informe o endereço da obra.";
    if (!form.city.trim()) return "Informe a cidade da obra.";
    if (!form.state.trim()) return "Informe o estado da obra.";
    if (!form.latitude || !form.longitude || !locationConfirmed) {
      return "Confirme a localização da obra no mapa.";
    }
    if (
      form.startDate &&
      form.expectedEndDate &&
      form.expectedEndDate < form.startDate
    ) {
      return "A previsão de término não pode ser anterior ao início.";
    }
    return null;
  }

  async function save() {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      if (form.code.trim()) {
        const { data: duplicate, error: duplicateError } = await supabase
          .from("works")
          .select("id")
          .eq("client_id", form.clientId)
          .eq("code", form.code.trim())
          .maybeSingle();

        if (duplicateError) throw duplicateError;
        if (duplicate) {
          toast.error("Já existe uma obra com este código para o cliente selecionado.");
          return;
        }
      }

      const { error } = await supabase.from("works").insert({
        client_id: form.clientId,
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim(),
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        zip_code: form.zipCode.trim() || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        responsible_name: form.responsibleName.trim() || null,
        responsible_phone: form.responsiblePhone.trim() || null,
        responsible_whatsapp: form.responsibleWhatsapp.trim() || null,
        responsible_email: form.responsibleEmail.trim() || null,
        status: form.status,
        start_date: form.startDate || null,
        expected_end_date: form.expectedEndDate || null,
        allow_new_freights: form.allowNewFreights,
        notes: form.notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Obra cadastrada com sucesso!");
      await navigate({ to: "/ops/obras" });
    } catch (error) {
      console.error("Erro ao salvar obra:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a obra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Nova obra"
      subtitle="Cadastre uma nova obra para organizar os fretes e operações por projeto."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/ops/obras">
              <ArrowLeft /> Voltar para obras
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void navigate({ to: "/ops/obras" })}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            <Save /> {saving ? "Salvando…" : "Salvar obra"}
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 pb-24">
        <Section icon={<Target />} title="Dados da obra">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da obra" required>
              <Input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Shopping Central"
              />
            </Field>
            <Field label="Código da obra">
              <Input
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
                placeholder="OBR-0001"
              />
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Descrição da obra"
                rows={3}
              />
            </Field>
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(event) => update("status", event.target.value as WorkStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {WORK_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section icon={<UserRound />} title="Cliente">
          <Field label="Cliente responsável" required>
            <select
              value={form.clientId}
              disabled={loadingClients}
              onChange={(event) => update("clientId", event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            >
              <option value="">
                {loadingClients ? "Carregando clientes…" : "Selecione um cliente"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.full_name || "Cliente sem nome"}
                </option>
              ))}
            </select>
          </Field>

          {selectedClient && (
            <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
              <div className="font-semibold">
                {selectedClient.company_name || selectedClient.full_name}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[selectedClient.cnpj, selectedClient.city, selectedClient.state]
                  .filter(Boolean)
                  .join(" · ") || "Dados cadastrais não informados"}
              </div>
            </div>
          )}
        </Section>

        <Section icon={<MapPin />} title="Localização da obra">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <MapboxAutocomplete
                label="Endereço"
                required
                value={form.address}
                onChange={(value) => update("address", value)}
                onSelect={handleLocation}
                placeholder="Pesquise o endereço da obra"
              />
            </div>
            <Field label="Número">
              <Input
                value={form.number}
                onChange={(event) => update("number", event.target.value)}
              />
            </Field>
            <Field label="Complemento">
              <Input
                value={form.complement}
                onChange={(event) => update("complement", event.target.value)}
              />
            </Field>
            <Field label="CEP">
              <Input
                value={form.zipCode}
                onChange={(event) => update("zipCode", event.target.value)}
              />
            </Field>
            <Field label="Bairro">
              <Input
                value={form.neighborhood}
                onChange={(event) => update("neighborhood", event.target.value)}
              />
            </Field>
            <Field label="Cidade" required>
              <Input
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </Field>
            <Field label="Estado" required>
              <Input
                maxLength={2}
                value={form.state}
                onChange={(event) => update("state", event.target.value.toUpperCase())}
                placeholder="MG"
              />
            </Field>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border">
            <TripMap
              className="h-64 w-full"
              destination={
                hasCoordinates
                  ? { lat: Number(form.latitude), lng: Number(form.longitude) }
                  : null
              }
              interactive
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {hasCoordinates
                ? `Coordenadas: ${Number(form.latitude).toFixed(6)}, ${Number(form.longitude).toFixed(6)}`
                : "Pesquise e selecione o endereço para localizar a obra."}
            </div>
            <Button
              type="button"
              variant={locationConfirmed ? "secondary" : "outline"}
              disabled={!hasCoordinates}
              onClick={() => setLocationConfirmed(true)}
            >
              <MapPin />
              {locationConfirmed ? "Localização confirmada" : "Confirmar localização"}
            </Button>
          </div>
        </Section>

        <Section icon={<UserRound />} title="Responsável pela obra">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input
                value={form.responsibleName}
                onChange={(event) => update("responsibleName", event.target.value)}
              />
            </Field>
            <Field label="Cargo / função">
              <Input placeholder="Responsável da obra" />
            </Field>
            <Field label="Telefone">
              <Input
                value={form.responsiblePhone}
                onChange={(event) => update("responsiblePhone", event.target.value)}
              />
            </Field>
            <Field label="WhatsApp">
              <Input
                value={form.responsibleWhatsapp}
                onChange={(event) => update("responsibleWhatsapp", event.target.value)}
              />
            </Field>
            <Field label="E-mail" className="sm:col-span-2">
              <Input
                type="email"
                value={form.responsibleEmail}
                onChange={(event) => update("responsibleEmail", event.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section icon={<CalendarDays />} title="Período da obra">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de início">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => update("startDate", event.target.value)}
              />
            </Field>
            <Field label="Previsão de término">
              <Input
                type="date"
                value={form.expectedEndDate}
                onChange={(event) => update("expectedEndDate", event.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section icon={<Target />} title="Configurações">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <span>
              <span className="block text-sm font-medium">Permitir novos fretes</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Quando desligado, a obra não aparecerá na criação de novos fretes.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.allowNewFreights}
              onChange={(event) => update("allowNewFreights", event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </Section>

        <Section title="Observações">
          <Textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={5}
            placeholder="Horários, restrições de acesso e orientações operacionais."
          />
        </Section>

        <section className="card-soft p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Resumo da obra
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Summary label="Obra" value={form.name || "—"} />
            <Summary label="Cliente" value={selectedClient?.company_name || selectedClient?.full_name || "—"} />
            <Summary label="Endereço" value={addressSummary || "—"} />
            <Summary label="Responsável" value={form.responsibleName || "—"} />
            <Summary label="Início" value={form.startDate || "—"} />
            <Summary label="Término previsto" value={form.expectedEndDate || "—"} />
            <Summary
              label="Status"
              value={WORK_STATUSES.find((item) => item.value === form.status)?.label ?? form.status}
            />
            <Summary label="Localização" value={locationConfirmed ? "Confirmada" : "Pendente"} />
          </dl>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <Button className="w-full" onClick={() => void save()} disabled={saving}>
          <Save /> {saving ? "Salvando…" : "Salvar obra"}
        </Button>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-soft p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}