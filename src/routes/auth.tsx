import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { logoUrl } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — InfinitLog" },
      { name: "description", content: "Área interna da InfinitLog Transportes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>
        <div>
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-primary-foreground/10 backdrop-blur">
            <img src={logoUrl} alt="InfinitLog" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight">
            Operação sob controle. Sempre.
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/70">
            Painel exclusivo da equipe InfinitLog: logística, motoristas e administração em um só lugar.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">© InfinitLog Transportes</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <h2 className="text-3xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesso à equipe, motoristas e clientes corporativos.
          </p>


          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="voce@infinitlog.com"
              />
            </Field>
            <Field label="Senha">
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Sua senha"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Aguarde…" : "Entrar"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
            <div>
              É motorista?{" "}
              <Link to="/cadastro-motorista" className="font-medium text-primary underline hover:opacity-80">
                Cadastre-se aqui
              </Link>
            </div>
            <div>
              É cliente? <Link to="/auth" className="underline hover:text-foreground">Entre aqui</Link> ou use o{" "}
              <Link to="/rastreio" className="underline hover:text-foreground">portal de rastreamento</Link>.
            </div>

          </div>

          <style>{`
            .input {
              width: 100%; height: 3rem; padding: 0 1rem; border-radius: 1rem;
              border: 1px solid var(--color-border); background: var(--color-surface);
              outline: none; font-size: 0.95rem; transition: border-color 120ms;
            }
            .input:focus { border-color: var(--color-primary); }
          `}</style>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
