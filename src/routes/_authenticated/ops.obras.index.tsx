import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { WORK_STATUSES, type Work } from "@/lib/work";
import { MapPin, Plus, Target, BarChart3 } from "lucide-react";
import { WorkKmReport } from "@/components/work-km-report";

export const Route = createFileRoute("/_authenticated/ops/obras/")({
  head: () => ({
    meta: [{ title: "Obras — InfinitLog" }, { name: "robots", content: "noindex" }],
  }),
  component: WorksList,
});

function WorksList() {
  const [reportWork, setReportWork] = useState<Work | null>(null);

  const worksQuery = useQuery({
    queryKey: ["works-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Work[];
    },
  });

  return (
    <AppShell
      title="Obras"
      subtitle="Organize os fretes por cliente e projeto."
      actions={
        <Button asChild>
          <Link to="/ops/obras/nova">
            <Plus /> Nova obra
          </Link>
        </Button>
      }
    >
      {worksQuery.isLoading ? (
        <div className="card-soft grid min-h-48 place-items-center text-sm text-muted-foreground">
          Carregando obras…
        </div>
      ) : worksQuery.isError ? (
        <div className="card-soft p-6 text-sm text-destructive">
          Não foi possível carregar as obras.
        </div>
      ) : worksQuery.data?.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Nenhuma obra cadastrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre a primeira obra para vinculá-la aos fretes.
          </p>
          <Button asChild className="mt-5">
            <Link to="/ops/obras/nova">
              <Plus /> Cadastrar obra
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {worksQuery.data?.map((work) => (
            <div key={work.id} className="card-soft p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{work.name}</h2>
                  {work.code && (
                    <p className="mt-1 text-xs text-muted-foreground">{work.code}</p>
                  )}
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {WORK_STATUSES.find((item) => item.value === work.status)?.label ?? work.status}
                </span>
              </div>

              <div className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {[work.city, work.state].filter(Boolean).join("/") || "Localização não informada"}
                </span>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground">
                  {work.allow_new_freights
                    ? "Disponível para novos fretes"
                    : "Bloqueada para novos fretes"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setReportWork(work)}
                >
                  <BarChart3 /> Relatório de KM
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reportWork && (
        <div className="mt-8" id="relatorio-km">
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" onClick={() => setReportWork(null)}>
              Fechar relatório
            </Button>
          </div>
          <WorkKmReport work={reportWork} />
        </div>
      )}
    </AppShell>
  );
}