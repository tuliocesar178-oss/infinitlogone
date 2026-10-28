import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload, UserRound } from "lucide-react";
import { DRIVER_COLUMNS } from "@/lib/driver-columns";
import { getDriverFinancials } from "@/lib/secure-driver-financials.functions";
import { useServerFn } from "@tanstack/react-start";
import { registrationPermissions } from '@/lib/registration.functions';
import { RegistrationAccess } from '@/components/ops/registration-access';
import { RegistrationDialog } from '@/components/ops/registration-dialog';
import { Button } from '@/components/ui/button';
import { CompletenessNotice } from '@/components/ops/completeness-notice';
import { reviewDriverSignup } from '@/lib/drivers.functions';
import {
  BANK_ACCOUNT_TYPES,
  FIN_STATUS,
  PAYMENT_METHOD_PREFS,
  PIX_KEY_TYPES,
} from "@/lib/pf";

export const Route = createFileRoute("/_authenticated/ops/motoristas/$id")({
  head: () => ({
    meta: [{ title: "Motorista — InfinitLog" },{name:'description',content:'Dados cadastrais, veículo e acesso do motorista INFINITLOG.'},{property:'og:title',content:'Motorista — InfinitLog'},{property:'og:description',content:'Dados e situação cadastral do motorista.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}, { name: "robots", content: "noindex" }],
  }),
  component: DriverDetail,
});

type Tab = "cadastro" | "financeiro";

function DriverDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("cadastro");
  const [form, setForm] = useState<any>({});
  const [profileName, setProfileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const permissions=useQuery({queryKey:['registration-permissions'],queryFn:()=>registrationPermissions()});

  const loadFinancials = useServerFn(getDriverFinancials);
  const review=useServerFn(reviewDriverSignup);

  const q = useQuery({
    queryKey: ["driver", id],
    queryFn: async () => {
      const [{ data: d }, { data: p }, { data: v }] = await Promise.all([
        supabase.from("drivers").select(DRIVER_COLUMNS as "*").eq("user_id", id).maybeSingle(),
        supabase.from("profiles").select("full_name, phone").eq("id", id).maybeSingle(),
        supabase.from("vehicles").select("*").eq("active", true).order("plate"),
      ]);
      let financials: any = null;
      try {
        financials = await loadFinancials({ data: { user_id: id } });
      } catch {
        financials = null;
      }
      return { driver: d ? { ...d, ...(financials ?? {}) } : d, profile: p, vehicles: v ?? [] };
    },
  });

  useEffect(() => {
    if (q.data?.driver) setForm(q.data.driver);
    if (q.data?.driver) setProfileName(q.data.profile?.full_name ?? q.data.driver.full_name ?? '');
  }, [q.data]);

  function set<K extends string>(k: K, v: any) {
    setForm((prev: any) => ({ ...prev, [k]: v }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("driver-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("driver-photos").getPublicUrl(path);
      set("photo_url", pub.publicUrl);
      toast.success("Foto enviada — clique em salvar para persistir.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        user_id: id,
        full_name: profileName,
        cpf: form.cpf,
        phone: form.phone,
        city: form.city,
        photo_url: form.photo_url,
        license_number: form.license_number,
        license_category: form.license_category,
        rntrc: form.rntrc,
        cnh_expires_at: form.cnh_expires_at,
        current_vehicle_id: form.current_vehicle_id,
        bank_name: form.bank_name,
        bank_code: form.bank_code,
        bank_agency: form.bank_agency,
        bank_account: form.bank_account,
        bank_account_digit: form.bank_account_digit,
        bank_account_type: form.bank_account_type,
        pix_key: form.pix_key,
        pix_key_type: form.pix_key_type,
        favored_name: form.favored_name,
        favored_document: form.favored_document,
        preferred_payment_method: form.preferred_payment_method,
        payment_term_days: form.payment_term_days ? Number(form.payment_term_days) : null,
        default_price_per_km: form.default_price_per_km
          ? Number(form.default_price_per_km)
          : null,
        min_freight_value: form.min_freight_value ? Number(form.min_freight_value) : null,
        financial_notes: form.financial_notes,
        financial_status: form.financial_status ?? "ativo",
      };
      const { error } = await supabase
        .from("drivers")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      if (profileName || form.phone) {
        await supabase
          .from("profiles")
          .update({ full_name: profileName, phone: form.phone })
          .eq("id", id);
      }
      toast.success("Motorista atualizado");
      qc.invalidateQueries({ queryKey: ["driver", id] });
      qc.invalidateQueries({ queryKey: ["drivers-list"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title={profileName || "Motorista"}
      subtitle="Cadastro e dados financeiros"
      actions={
        <Link
          to="/ops/motoristas"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setEditOpen(true)}>Editar cadastro completo</Button>{permissions.data?.isAdmin&&<><RegistrationAccess id={id} kind="driver"/><select aria-label="Situação cadastral" className="rounded-md border border-input bg-background px-3 text-sm" value={form.approval_status??'pending'} onChange={async e=>{const value=e.target.value;const decision=value==='active'?'approve':value==='rejected'?'reject':value==='correction'?'correction':null;if(!decision)return;try{await review({data:{driver_id:id,decision}});await qc.invalidateQueries({queryKey:['driver',id]});toast.success('Situação atualizada.');}catch(error){toast.error(error instanceof Error?error.message:'Falha ao alterar situação.');}}}><option value="pending">Pendente</option><option value="active">Aprovado</option><option value="rejected">Bloqueado / reprovado</option><option value="correction">Correção solicitada</option></select></>}<span className="self-center text-xs text-muted-foreground">Telefone não verificado</span></div>
      {editOpen&&<RegistrationDialog open onClose={()=>setEditOpen(false)} kind="driver" onCreated={()=>{qc.invalidateQueries({queryKey:['driver',id]});}} initial={{id,full_name:profileName,phone:form.phone??'',email:form.email??'',document:form.cpf??'',city:form.city??'',state:form.state??'',address:form.address??'',address_number:form.address_number??'',neighborhood:form.neighborhood??'',zip_code:form.zip??'',notes:form.notes??'',birth_date:form.birth_date??'',license_number:form.license_number??'',license_category:form.license_category??'',cnh_expires_at:form.cnh_expires_at??'',rntrc:form.rntrc??'',pix_key:form.pix_key??''}}/>}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        {form.photo_url ? (
          <img src={form.photo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-2xl bg-surface-2">
            <UserRound className="h-8 w-8 text-muted-foreground" />
          </span>
        )}
        <div className="flex-1">
          <div className="text-lg font-semibold">{profileName || "—"}</div>
          <div className="text-xs text-muted-foreground">
            Situação:{" "}
            <span className="font-medium text-foreground">
              {FIN_STATUS.find((s) => s.value === form.financial_status)?.label ?? "—"}
            </span>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
          <input type="file" accept="image/*" hidden onChange={onPhoto} disabled={uploading} />
          <Upload className="h-4 w-4" /> {uploading ? "Enviando…" : "Trocar foto"}
        </label>
      </div>

      <div className="mb-6 inline-flex rounded-2xl bg-surface-2 p-1">
        {(["cadastro", "financeiro"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "cadastro" ? "Cadastro" : "Financeiro"}
          </button>
        ))}
      </div>

      {tab === "cadastro" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Nome completo">
            <input
              className="input"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </Field>
          <Field label="CPF">
            <input className="input" value={form.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input
              className="input"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="Cidade">
            <input className="input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="CNH">
            <input
              className="input"
              value={form.license_number ?? ""}
              onChange={(e) => set("license_number", e.target.value)}
            />
          </Field>
          <Field label="Categoria da CNH">
            <input
              className="input"
              value={form.license_category ?? ""}
              onChange={(e) => set("license_category", e.target.value)}
            />
          </Field>
          <Field label="Validade da CNH">
            <input
              type="date"
              className="input"
              value={form.cnh_expires_at ?? ""}
              onChange={(e) => set("cnh_expires_at", e.target.value)}
            />
          </Field>
          <Field label="RNTRC / ANTT">
            <input
              className="input"
              value={form.rntrc ?? ""}
              onChange={(e) => set("rntrc", e.target.value)}
            />
          </Field>
          <Field label="Veículo">
            <select
              className="input"
              value={form.current_vehicle_id ?? ""}
              onChange={(e) => set("current_vehicle_id", e.target.value || null)}
            >
              <option value="">— selecionar —</option>
              {q.data?.vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.brand ?? ""} {v.model ?? ""} ({v.vehicle_type ?? "—"})
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {tab === "financeiro" && (
        <div className="space-y-8">
          <section>
            <SectionTitle>Dados bancários</SectionTitle>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Banco">
                <input
                  className="input"
                  value={form.bank_name ?? ""}
                  onChange={(e) => set("bank_name", e.target.value)}
                />
              </Field>
              <Field label="Código do banco">
                <input
                  className="input"
                  value={form.bank_code ?? ""}
                  onChange={(e) => set("bank_code", e.target.value)}
                />
              </Field>
              <Field label="Agência">
                <input
                  className="input"
                  value={form.bank_agency ?? ""}
                  onChange={(e) => set("bank_agency", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field label="Conta">
                  <input
                    className="input"
                    value={form.bank_account ?? ""}
                    onChange={(e) => set("bank_account", e.target.value)}
                  />
                </Field>
                <Field label="Dígito">
                  <input
                    className="input w-20"
                    value={form.bank_account_digit ?? ""}
                    onChange={(e) => set("bank_account_digit", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Tipo de conta">
                <select
                  className="input"
                  value={form.bank_account_type ?? ""}
                  onChange={(e) => set("bank_account_type", e.target.value || null)}
                >
                  <option value="">—</option>
                  {BANK_ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>PIX e favorecido</SectionTitle>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Chave PIX">
                <input
                  className="input"
                  value={form.pix_key ?? ""}
                  onChange={(e) => set("pix_key", e.target.value)}
                />
              </Field>
              <Field label="Tipo da chave PIX">
                <select
                  className="input"
                  value={form.pix_key_type ?? ""}
                  onChange={(e) => set("pix_key_type", e.target.value || null)}
                >
                  <option value="">—</option>
                  {PIX_KEY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nome do favorecido">
                <input
                  className="input"
                  value={form.favored_name ?? ""}
                  onChange={(e) => set("favored_name", e.target.value)}
                />
              </Field>
              <Field label="CPF / CNPJ do favorecido">
                <input
                  className="input"
                  value={form.favored_document ?? ""}
                  onChange={(e) => set("favored_document", e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Recebimento e valores</SectionTitle>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Forma preferida de recebimento">
                <select
                  className="input"
                  value={form.preferred_payment_method ?? ""}
                  onChange={(e) => set("preferred_payment_method", e.target.value || null)}
                >
                  <option value="">—</option>
                  {PAYMENT_METHOD_PREFS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Prazo de pagamento (dias)">
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.payment_term_days ?? ""}
                  onChange={(e) => set("payment_term_days", e.target.value)}
                />
              </Field>
              <Field label="Valor padrão por KM">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.default_price_per_km ?? ""}
                  onChange={(e) => set("default_price_per_km", e.target.value)}
                />
              </Field>
              <Field label="Valor mínimo por frete">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.min_freight_value ?? ""}
                  onChange={(e) => set("min_freight_value", e.target.value)}
                />
              </Field>
              <Field label="Situação financeira" className="md:col-span-1">
                <select
                  className="input"
                  value={form.financial_status ?? "ativo"}
                  onChange={(e) => set("financial_status", e.target.value)}
                >
                  {FIN_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Observações financeiras" className="md:col-span-2">
                <textarea
                  className="input min-h-[100px] py-3"
                  value={form.financial_notes ?? ""}
                  onChange={(e) => set("financial_notes", e.target.value)}
                />
              </Field>
            </div>
          </section>
        </div>
      )}

      <div className="sticky bottom-4 mt-10 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          height: 3rem;
          padding: 0 1rem;
          border-radius: 1rem;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          outline: none;
          font-size: 0.95rem;
        }
        .input:focus { border-color: var(--color-brand); }
      `}</style>
    </AppShell>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}
