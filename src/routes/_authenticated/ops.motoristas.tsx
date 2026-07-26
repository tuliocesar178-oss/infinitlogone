import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Plus, UserRound } from "lucide-react";
import { labelOf, FIN_STATUS } from "@/lib/pf";

export const Route = createFileRoute("/_authenticated/ops/motoristas")({
  head: () => ({
    meta: [{ title: "Motoristas — InfinitLog" }, { name: "robots", content: "noindex" }],
  }),
  component: DriversList,
});

function DriversList() {
  const { data } = useQuery({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select(
          "user_id, status, financial_status, city, phone, cpf, photo_url, profiles:profiles!inner(id, full_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell
      title="Motoristas"
      subtitle="Cadastro completo, dados financeiros e situação."
      actions={
        <Link
          to="/ops"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          Voltar
        </Link>
      }
    >
      <div className="grid gap-3">
        {(data ?? []).map((d: any) => (
          <Link
            key={d.user_id}
            to="/ops/motoristas/$id"
            params={{ id: d.user_id }}
            className="card-soft flex items-center gap-4 p-4 transition hover:shadow-md"
          >
            {d.photo_url ? (
              <img src={d.photo_url} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2">
                <UserRound className="h-6 w-6 text-muted-foreground" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {d.profiles?.full_name ?? "Sem nome"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {d.city ?? "—"} · {d.phone ?? "sem telefone"} · CPF {d.cpf ?? "—"}
              </div>
            </div>
            <span
              className={`hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-block ${
                d.financial_status === "ativo"
                  ? "bg-emerald-50 text-emerald-700"
                  : d.financial_status === "bloqueado"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {labelOf(FIN_STATUS, d.financial_status)}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        {(data ?? []).length === 0 && (
          <div className="card-soft grid place-items-center p-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
              <UserRound className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhum motorista</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Motoristas aparecem aqui após serem cadastrados no sistema.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
