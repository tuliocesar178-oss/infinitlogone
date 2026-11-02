import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, XCircle, AlertTriangle, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/aguardando-aprovacao")({
  head: () => ({ meta: [
      { name: "description", content: 'Aguardando aprovação — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:title", content: 'Aguardando aprovação — InfinitLog' },
      { property: "og:description", content: 'Aguardando aprovação — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "Aguardando aprovação — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<{ status: string; reason?: string | null; correction?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return navigate({ to: "/auth" });
      const { data } = await supabase
        .from("drivers")
        .select("approval_status,rejection_reason,correction_notes")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!data) return navigate({ to: "/app" });
      if (data.approval_status === "active") return navigate({ to: "/driver" });
      setState({
        status: data.approval_status,
        reason: data.rejection_reason,
        correction: data.correction_notes,
      });
    })();
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (!state) return <div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const cfg = {
    pending: { icon: Clock, tint: "text-amber-600 bg-amber-500/10", title: "Cadastro em análise",
      body: "Seu cadastro foi recebido com sucesso. Nossa equipe irá analisar suas informações. Você receberá uma notificação assim que seu cadastro for aprovado." },
    correction: { icon: AlertTriangle, tint: "text-amber-600 bg-amber-500/10", title: "Correção solicitada",
      body: state.correction ?? "Ajustes solicitados no seu cadastro. Reenvie os documentos indicados." },
    rejected: { icon: XCircle, tint: "text-red-600 bg-red-500/10", title: "Cadastro reprovado",
      body: state.reason ?? "Seu cadastro foi reprovado. Você pode enviar um novo cadastro futuramente." },
    active: { icon: CheckCircle2, tint: "text-emerald-600 bg-emerald-500/10", title: "Aprovado!", body: "Redirecionando…" },
  }[state.status] ?? { icon: Clock, tint: "text-amber-600 bg-amber-500/10", title: "Aguardando", body: "" };
  const Icon = cfg.icon;

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2/40 p-6">
      <div className="card-soft w-full max-w-md p-8 text-center">
        <Logo size={40} className="mx-auto" />
        <div className={`mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full ${cfg.tint}`}>
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{cfg.title}</h1>
        <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{cfg.body}</p>
        <div className="mt-8 flex flex-col gap-2">
          <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm hover:bg-accent">
            <LogOut className="h-4 w-4" /> Sair
          </button>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">Voltar ao site</Link>
        </div>
      </div>
    </div>
  );
}
