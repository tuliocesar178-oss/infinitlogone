import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — InfinitLog" },
      { name: "description", content: "Defina uma nova senha de acesso à plataforma InfinitLog." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // O link de recuperação chega com os tokens no hash da URL; o cliente Supabase
  // cria a sessão automaticamente. Aguardamos o evento para liberar o formulário.
  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setValid(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setValid(true);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada! Faça login novamente.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2/40 p-6">
      <div className="card-soft w-full max-w-sm p-8">
        <Logo size={190} className="mx-auto" />

        {!ready ? (
          <div className="mt-10 grid place-items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !valid ? (
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Link inválido ou expirado</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Solicite um novo e-mail de recuperação na tela de login.
            </p>
            <Link
              to="/auth"
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">Nova senha</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Defina a senha que você usará para entrar no app.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Nova senha
                </span>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rp-input"
                  placeholder="Mínimo 6 caracteres"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Confirmar senha
                </span>
                <input
                  required
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="rp-input"
                  placeholder="Repita a senha"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>

            <Link
              to="/auth"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
            </Link>
          </>
        )}

        <style>{`
          .rp-input {
            width: 100%; height: 3rem; padding: 0 1rem; border-radius: 1rem;
            border: 1px solid var(--color-border); background: var(--color-surface);
            outline: none; font-size: 0.95rem; transition: border-color 120ms;
          }
          .rp-input:focus { border-color: var(--color-primary); }
        `}</style>
      </div>
    </div>
  );
}
