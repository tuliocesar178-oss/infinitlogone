import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { VehicleForm } from "@/components/vehicle-form";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/veiculos/novo")({
  head: () => ({ meta: [
      { name: "description", content: 'Novo veículo — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:title", content: 'Novo veículo — InfinitLog' },
      { property: "og:description", content: 'Novo veículo — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "Novo veículo — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: NewVehicle,
});

function NewVehicle() {
  const navigate = useNavigate();
  return (
    <AppShell
      title="Novo veículo"
      subtitle="Cadastre um veículo próprio ou agregado com documentação completa"
      actions={
        <button
          onClick={() => navigate({ to: "/ops/veiculos" })}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      }
    >
      <VehicleForm
        onSaved={(id) => navigate({ to: "/ops/veiculos/$id", params: { id } })}
      />
    </AppShell>
  );
}
