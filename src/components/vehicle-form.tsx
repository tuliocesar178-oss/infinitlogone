import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_STATUS } from "@/lib/vehicles";
import { Upload, Save, Truck } from "lucide-react";
import { toast } from "sonner";

type Vehicle = any;

export function VehicleForm({ initial, onSaved }: { initial?: Vehicle; onSaved?: (id: string) => void | Promise<void> }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Vehicle>(
    initial ?? {
      plate: "",
      status: "disponivel",
      active: true,
      vehicle_type: "",
    },
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial?.id]);

  const types = useQuery({
    queryKey: ["vehicle-types-form"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_types").select("id, name").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const drivers = useQuery({
    queryKey: ["drivers-select"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("user_id, profiles:profiles!inner(full_name)");
      return data ?? [];
    },
  });

  const set = (k: string, v: any) => setForm((f: Vehicle) => ({ ...f, [k]: v }));

  async function addNewType() {
    const name = window.prompt("Nome do novo tipo de veículo:");
    if (!name?.trim()) return;
    const { error } = await supabase.from("vehicle_types").insert({ name: name.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["vehicle-types-form"] });
    await qc.invalidateQueries({ queryKey: ["vehicle-types"] });
    set("vehicle_type", name.trim());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plate?.trim()) {
      toast.error("Placa é obrigatória");
      return;
    }
    setSaving(true);
    try {
      const payload: Vehicle = { ...form };
      // strip empty date/number strings
      const emptyDateKeys = ["crlv_expires_at", "licensing_expires_at", "insurance_expires_at", "ipva_expires_at", "antt_expires_at", "acquisition_date"];
      for (const k of emptyDateKeys) if (payload[k] === "") payload[k] = null;
      const numKeys = ["year", "capacity_kg", "capacity_m3", "axles", "current_km", "max_weight_kg"];
      for (const k of numKeys) if (payload[k] === "" || payload[k] === undefined) payload[k] = null;

      let vehicleId = form.id as string | undefined;
      if (vehicleId) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("vehicles").insert(payload).select("id").single();
        if (error) throw error;
        vehicleId = data.id;
      }

      // Upload photo if selected
      if (photoFile && vehicleId) {
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${vehicleId}/photo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("vehicle-files").upload(path, photoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("vehicle-files").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) {
          await supabase.from("vehicles").update({ photo_url: signed.signedUrl }).eq("id", vehicleId);
        }
      }

      toast.success("Veículo salvo");
      await qc.invalidateQueries({ queryKey: ["vehicles-list"] });
      if (vehicleId) await onSaved?.(vehicleId);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Foto + identificação */}
      <Section title="Identificação">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 text-xs text-muted-foreground hover:border-brand">
              {photoFile ? (
                <img src={URL.createObjectURL(photoFile)} alt="" className="h-full w-full rounded-2xl object-cover" />
              ) : form.photo_url ? (
                <img src={form.photo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <>
                  <Truck className="h-6 w-6" />
                  <Upload className="h-4 w-4" /> Foto do veículo
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Placa *" value={form.plate ?? ""} onChange={(v) => set("plate", v.toUpperCase())} />
            <Field label="Marca" value={form.brand ?? ""} onChange={(v) => set("brand", v)} />
            <Field label="Modelo" value={form.model ?? ""} onChange={(v) => set("model", v)} />
            <Field label="Ano" type="number" value={form.year ?? ""} onChange={(v) => set("year", v ? Number(v) : null)} />
            <Field label="Cor" value={form.color ?? ""} onChange={(v) => set("color", v)} />
            <Select label="Status" value={form.status ?? "disponivel"} onChange={(v) => set("status", v)}
              options={VEHICLE_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
          </div>
        </div>
      </Section>

      {/* Documentação */}
      <Section title="Documentação">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="RENAVAM" value={form.renavam ?? ""} onChange={(v) => set("renavam", v)} />
          <Field label="Chassi" value={form.chassis ?? ""} onChange={(v) => set("chassis", v)} />
          <Field label="Categoria" value={form.category ?? ""} onChange={(v) => set("category", v)} />
          <Field label="CRLV vencimento" type="date" value={form.crlv_expires_at ?? ""} onChange={(v) => set("crlv_expires_at", v)} />
          <Field label="Licenciamento" type="date" value={form.licensing_expires_at ?? ""} onChange={(v) => set("licensing_expires_at", v)} />
          <Field label="IPVA vencimento" type="date" value={form.ipva_expires_at ?? ""} onChange={(v) => set("ipva_expires_at", v)} />
        </div>
      </Section>

      {/* Tipo e capacidades */}
      <Section title="Tipo e Capacidades">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Tipo de veículo</label>
            <div className="flex gap-2">
              <select
                value={form.vehicle_type ?? ""}
                onChange={(e) => set("vehicle_type", e.target.value)}
                className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
              >
                <option value="">—</option>
                {(types.data ?? []).map((t: any) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              <button type="button" onClick={addNewType} className="rounded-xl border border-border px-3 text-sm hover:bg-accent">+</button>
            </div>
          </div>
          <Field label="Tipo de carroceria" value={form.body_type ?? ""} onChange={(v) => set("body_type", v)} />
          <Field label="Nº de eixos" type="number" value={form.axles ?? ""} onChange={(v) => set("axles", v ? Number(v) : null)} />
          <Field label="Capacidade (kg)" type="number" value={form.capacity_kg ?? ""} onChange={(v) => set("capacity_kg", v ? Number(v) : null)} />
          <Field label="Capacidade (m³)" type="number" value={form.capacity_m3 ?? ""} onChange={(v) => set("capacity_m3", v ? Number(v) : null)} />
          <Field label="KM atual" type="number" value={form.current_km ?? ""} onChange={(v) => set("current_km", v ? Number(v) : null)} />
        </div>
      </Section>

      {/* Seguro & ANTT */}
      <Section title="Seguro e ANTT">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Seguradora" value={form.insurance_company ?? ""} onChange={(v) => set("insurance_company", v)} />
          <Field label="Nº da apólice" value={form.insurance_policy ?? ""} onChange={(v) => set("insurance_policy", v)} />
          <Field label="Validade do seguro" type="date" value={form.insurance_expires_at ?? ""} onChange={(v) => set("insurance_expires_at", v)} />
          <Field label="Nº ANTT/RNTRC" value={form.antt_number ?? ""} onChange={(v) => set("antt_number", v)} />
          <Field label="Validade ANTT" type="date" value={form.antt_expires_at ?? ""} onChange={(v) => set("antt_expires_at", v)} />
          <Field label="Data de aquisição" type="date" value={form.acquisition_date ?? ""} onChange={(v) => set("acquisition_date", v)} />
        </div>
      </Section>

      {/* Vínculos */}
      <Section title="Vínculos">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">Motorista responsável</label>
            <select
              value={form.owner_driver_id ?? ""}
              onChange={(e) => set("owner_driver_id", e.target.value || null)}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
            >
              <option value="">Sem motorista fixo</option>
              {(drivers.data ?? []).map((d: any) => (
                <option key={d.user_id} value={d.user_id}>{d.profiles?.full_name ?? d.user_id}</option>
              ))}
            </select>
          </div>
          <Field label="Empresa proprietária" value={form.owner_company ?? ""} onChange={(v) => set("owner_company", v)} />
        </div>
      </Section>

      {/* Observações */}
      <Section title="Observações">
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
          placeholder="Notas internas sobre o veículo…"
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar veículo"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-soft p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
