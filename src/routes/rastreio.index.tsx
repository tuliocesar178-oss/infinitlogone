import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/rastreio/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Rastrear pedido — InfinitLog" },
      { name: "description", content: "Acompanhe sua carga em tempo real. Digite o código de rastreio ou o número do pedido." },
      { property: "og:title", content: "Rastrear pedido — InfinitLog" },
      { property: "og:description", content: "Digite seu código de rastreio para ver a jornada da sua carga." },
    ],
  }),
  component: TrackingSearch,
});

function TrackingSearch() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = code.trim();
    if (!v) return;
    navigate({ 
      to: "/rastreio/$code", 
      params: { code: v.toUpperCase() } 
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <Link to="/" aria-label="InfinitLog">
            <Logo size={30} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-24">
        <h1 className="text-4xl font-semibold tracking-tight">Rastrear pedido</h1>
        <p className="mt-3 text-muted-foreground">
          Digite o código de rastreio ou o número do pedido informado pela nossa equipe.
        </p>

        <form onSubmit={submit} className="card-soft mt-10 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-surface-2 px-5 py-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex.: IL9F3C8A21B0 ou PED-A1B2C3D4"
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Código de rastreio"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Rastrear <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </main>
    </div>
  );
}
