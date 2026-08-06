import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/cadastro-cliente")({
  head: () => ({
    meta: [
      { title: "Cadastro de Cliente — InfinitLog" },
      { name: "description", content: "Crie sua conta corporativa na InfinitLog Transportes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientSignup,
});

type FormState = {
  full_name: string;
  company_name: string;
  cnpj: string;
  email: string;
  password: string;
  phone: string;
  whatsapp: string;
  zip_code: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  state: string;
};

function ClientSignup() {
  const navigate = useNavigate();
  const [f, setF] = useState<FormState>({
    full_name: "",
    company_name: "",
    cnpj: "",
    email: "",
    password: "",
    phone: "",
    whatsapp: "",
    zip_code: "",
    address: "",
    address_number: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [loading, setLoading] = useState(false);

  function on<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Sign up user
      const { data: signUp, error: suErr } = await supabase.auth.signUp({
        email: f.email,
        password: f.password,
        options: {
          data: {
            full_name: f.full_name,
            company_name: f.company_name,
            cnpj: f.cnpj,
            phone: f.phone,
            whatsapp: f.whatsapp,
            zip_code: f.zip_code,
            address: f.address,
            address_number: f.address_number,
            neighborhood: f.neighborhood,
            city: f.city,
            state: f.state,
            role: 'client', // Internal flag for the profile trigger
          },
        },
      });

      if (suErr) throw suErr;
      if (!signUp.user) throw new Error("Falha ao criar usuário");

      // 2. Assign client role (the system should have a trigger for this, but let's be safe if possible)
      // Usually, we use a DB trigger to auto-assign 'client' role to new users with metadata 'role: client'
      
      toast.success("Conta criada com sucesso! Redirecionando...");
      
      // Auto sign in and redirect
      await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      navigate({ to: "/client", replace: true });
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
        <h1 className="text-3xl font-semibold tracking-tight">Cadastro de Cliente Corporativo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie sua conta para acompanhar seus fretes, documentos e indicadores em tempo real.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <Section title="Dados da Empresa">
            <F label="Nome da Empresa / Razão Social *"><I value={f.company_name} onChange={(v) => on("company_name", v)} required /></F>
            <F label="CNPJ *"><I value={f.cnpj} onChange={(v) => on("cnpj", v)} required /></F>
            <F label="Nome do Responsável *"><I value={f.full_name} onChange={(v) => on("full_name", v)} required /></F>
          </Section>

          <Section title="Contato">
            <F label="E-mail *"><I type="email" value={f.email} onChange={(v) => on("email", v)} required /></F>
            <F label="Senha *"><I type="password" value={f.password} onChange={(v) => on("password", v)} required /></F>
            <F label="Telefone"><I value={f.phone} onChange={(v) => on("phone", v)} /></F>
            <F label="WhatsApp"><I value={f.whatsapp} onChange={(v) => on("whatsapp", v)} /></F>
          </Section>

          <Section title="Endereço Principal">
            <F label="CEP"><I value={f.zip_code} onChange={(v) => on("zip_code", v)} /></F>
            <F label="Endereço" full><I value={f.address} onChange={(v) => on("address", v)} /></F>
            <F label="Número"><I value={f.address_number} onChange={(v) => on("address_number", v)} /></F>
            <F label="Bairro"><I value={f.neighborhood} onChange={(v) => on("neighborhood", v)} /></F>
            <F label="Cidade"><I value={f.city} onChange={(v) => on("city", v)} /></F>
            <F label="Estado"><I value={f.state} onChange={(v) => on("state", v)} /></F>
          </Section>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Criando conta…" : "Concluir Cadastro"}
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
