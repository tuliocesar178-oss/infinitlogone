import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { useServerFn } from "@tanstack/react-start";
import { selfRegisterDriver } from "@/lib/registration-access.functions";
import { passwordPairError } from "@/lib/access-credentials";
import { PasswordField } from "@/components/ops/password-field";

export const Route = createFileRoute("/cadastro-motorista")({
  head: () => ({
    meta: [
      { property: "og:title", content: 'Cadastre-se como Motorista — InfinitLog' },
      { property: "og:description", content: 'Cadastre-se como Motorista — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Cadastre-se como Motorista — InfinitLog" },
      { name: "description", content: "Envie seu cadastro para dirigir com a InfinitLog Transportes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverSignup,
});

const DOC_KINDS = [
  { key: "cnh", label: "CNH" },
  { key: "foto_motorista", label: "Foto do Motorista" },
  { key: "crlv", label: "CRLV" },
  { key: "antt", label: "ANTT" },
  { key: "comprovante_residencia", label: "Comprovante de Residência" },
] as const;

type FormState = {
  full_name: string; cpf: string; rg: string; license_number: string;
  license_category: string; cnh_expires_at: string; rntrc: string;
  phone: string; whatsapp: string; email: string; password: string; confirm: string;
  address: string; city: string; state: string; zip: string;
  bank_name: string; bank_agency: string; bank_account: string; pix_key: string;
  vehicle_type: string; vehicle_model: string; vehicle_plate: string; vehicle_capacity: string;
};

function DriverSignup() {
  const navigate = useNavigate();
  const [f, setF] = useState<FormState>({
    full_name: "", cpf: "", rg: "", license_number: "", license_category: "",
    cnh_expires_at: "", rntrc: "", phone: "", whatsapp: "", email: "", password: "", confirm: "",
    address: "", city: "", state: "", zip: "",
    bank_name: "", bank_agency: "", bank_account: "", pix_key: "",
    vehicle_type: "", vehicle_model: "", vehicle_plate: "", vehicle_capacity: "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const register = useServerFn(selfRegisterDriver);

  function on<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const pwError = passwordPairError(f.password, f.confirm);
    if (pwError) { toast.error(pwError); return; }
    const missing = DOC_KINDS.filter((d) => !files[d.key]);
    if (missing.length) {
      toast.warning(`Envie: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setLoading(true);
    try {
      const { login } = await register({ data: {
        phone: f.phone, email: f.email.trim(), password: f.password,
        metadata: {
          full_name: f.full_name, cpf: f.cpf, rg: f.rg,
          license_number: f.license_number, license_category: f.license_category,
          cnh_expires_at: f.cnh_expires_at || null, rntrc: f.rntrc,
          whatsapp: f.whatsapp, address: f.address, city: f.city, state: f.state, zip: f.zip,
          pix_key: f.pix_key,
        },
      } });
      const { data: signedIn, error: siErr } = await supabase.auth.signInWithPassword({ email: login, password: f.password });
      if (siErr || !signedIn.user) throw new Error("Cadastro criado. Entre com telefone e senha na tela de login.");
      const uid = signedIn.user.id;

      // Upload documents
      for (const d of DOC_KINDS) {
        const file = files[d.key];
        if (!file) continue;
        const path = `${uid}/${d.key}-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("driver-documents")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (upErr) throw upErr;
        await supabase.from("driver_documents").insert({
          driver_id: uid, kind: d.key, label: d.label,
          file_path: path, mime_type: file.type, size_bytes: file.size,
          uploaded_by: uid,
        });
      }

      // Update driver row with bank + vehicle data
      await supabase.from("drivers").update({
        bank_name: f.bank_name, bank_agency: f.bank_agency,
        bank_account: f.bank_account, pix_key: f.pix_key,
        notes: `Veículo: ${f.vehicle_type} ${f.vehicle_model} · Placa ${f.vehicle_plate} · ${f.vehicle_capacity}kg`,
      }).eq("user_id", uid);

      toast.success("Cadastro enviado!");
      navigate({ to: "/aguardando-aprovacao" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no cadastro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-2/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <Logo size={30} />
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Já tenho conta</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Cadastre-se como motorista</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Preencha seus dados e envie os documentos. Nossa equipe irá analisar e liberar seu acesso.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <Section title="Dados pessoais">
            <F label="Nome completo *"><I value={f.full_name} onChange={(v) => on("full_name", v)} required /></F>
            <F label="CPF *"><I value={f.cpf} onChange={(v) => on("cpf", v)} required /></F>
            <F label="RG"><I value={f.rg} onChange={(v) => on("rg", v)} /></F>
            <F label="Telefone *"><I value={f.phone} onChange={(v) => on("phone", v)} required /></F>
            <F label="WhatsApp"><I value={f.whatsapp} onChange={(v) => on("whatsapp", v)} /></F>
          </Section>

          <Section title="CNH e habilitação">
            <F label="Número CNH *"><I value={f.license_number} onChange={(v) => on("license_number", v)} required /></F>
            <F label="Categoria *"><I value={f.license_category} onChange={(v) => on("license_category", v)} placeholder="D, E..." required /></F>
            <F label="Validade *"><I type="date" value={f.cnh_expires_at} onChange={(v) => on("cnh_expires_at", v)} required /></F>
            <F label="RNTRC / ANTT"><I value={f.rntrc} onChange={(v) => on("rntrc", v)} /></F>
          </Section>

          <Section title="Endereço">
            <F label="Endereço" full><I value={f.address} onChange={(v) => on("address", v)} /></F>
            <F label="Cidade"><I value={f.city} onChange={(v) => on("city", v)} /></F>
            <F label="Estado"><I value={f.state} onChange={(v) => on("state", v)} /></F>
            <F label="CEP"><I value={f.zip} onChange={(v) => on("zip", v)} /></F>
          </Section>

          <Section title="Acesso">
            <F label="E-mail (opcional)"><I type="email" value={f.email} onChange={(v) => on("email", v)} /></F>
            <PasswordField label="Senha *" autoComplete="new-password" required value={f.password} onChange={(e) => on("password", e.target.value)} />
            <PasswordField label="Confirmar senha *" autoComplete="new-password" required value={f.confirm} onChange={(e) => on("confirm", e.target.value)} />
          </Section>

          <Section title="Dados bancários / PIX">
            <F label="Banco"><I value={f.bank_name} onChange={(v) => on("bank_name", v)} /></F>
            <F label="Agência"><I value={f.bank_agency} onChange={(v) => on("bank_agency", v)} /></F>
            <F label="Conta"><I value={f.bank_account} onChange={(v) => on("bank_account", v)} /></F>
            <F label="Chave PIX"><I value={f.pix_key} onChange={(v) => on("pix_key", v)} /></F>
          </Section>

          <Section title="Veículo">
            <F label="Tipo"><I value={f.vehicle_type} onChange={(v) => on("vehicle_type", v)} placeholder="Truck, Toco..." /></F>
            <F label="Modelo"><I value={f.vehicle_model} onChange={(v) => on("vehicle_model", v)} /></F>
            <F label="Placa"><I value={f.vehicle_plate} onChange={(v) => on("vehicle_plate", v)} /></F>
            <F label="Capacidade (kg)"><I value={f.vehicle_capacity} onChange={(v) => on("vehicle_capacity", v)} /></F>
          </Section>

          <section className="card-soft p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Documentos obrigatórios
            </h2>
            <ul className="mt-4 space-y-2">
              {DOC_KINDS.map((d) => {
                const has = !!files[d.key];
                return (
                  <li key={d.key} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${has ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
                    <div className="flex items-center gap-2 text-sm">
                      {has ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium">{d.label}</span>
                      {has && <span className="text-xs text-muted-foreground">{files[d.key]?.name}</span>}
                    </div>
                    <label className="cursor-pointer rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">
                      <input
                        type="file"
                        hidden
                        accept="image/*,application/pdf"
                        onChange={(e) => setFiles((p) => ({ ...p, [d.key]: e.target.files?.[0] ?? null }))}
                      />
                      {has ? "Trocar" : "Enviar"}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Enviando cadastro…" : "Enviar cadastro para aprovação"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-soft p-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function I({ value, onChange, type = "text", required, placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      required={required}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
    />
  );
}
