import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, FileText, Eye } from "lucide-react";
import { reviewDriverSignup } from "@/lib/drivers.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/ops/motoristas/aprovacoes")({
  head: () => ({ meta: [{ title: "Solicitações de cadastro — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: DriverApprovalsPage,
});

type Row = {
  user_id: string; phone: string | null; city: string | null; photo_url: string | null;
  display_photo_url: string | null;
  license_number: string | null; rntrc: string | null; approval_status: string;
  submitted_at: string | null; rejection_reason: string | null; correction_notes: string | null;
  notes: string | null;
  profiles: { full_name: string | null } | null;
};

function DriverApprovalsPage() {
  const review_fn = useServerFn(reviewDriverSignup);
  const [filter, setFilter] = useState<"pending" | "correction" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<Row | null>(null);

  const q = useQuery({
    queryKey: ["driver-approvals", filter],
    queryFn: async () => {
      let query = supabase
        .from("drivers")
        .select("user_id,phone,city,photo_url,license_number,rntrc,approval_status,submitted_at,rejection_reason,correction_notes,notes")
        .order("submitted_at", { ascending: false });
      if (filter !== "all") query = query.eq("approval_status", filter);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Array<Omit<Row, "profiles">>;
      const ids = rows.map((r) => r.user_id);
      let profileMap = new Map<string, { full_name: string | null }>();
      let documentPhotoMap = new Map<string, string>();
      if (ids.length) {
        const [{ data: profs }, { data: photoDocs }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", ids),
          supabase
            .from("driver_documents")
            .select("driver_id, file_path, mime_type, created_at")
            .in("driver_id", ids)
            .eq("kind", "foto_motorista")
            .order("created_at", { ascending: false }),
        ]);
        profileMap = new Map((profs ?? []).map((p) => [p.id, { full_name: p.full_name }]));

        const latestImageDocs = new Map<string, string>();
        for (const doc of photoDocs ?? []) {
          if (latestImageDocs.has(doc.driver_id)) continue;
          if (doc.mime_type && !doc.mime_type.startsWith("image/")) continue;
          latestImageDocs.set(doc.driver_id, doc.file_path);
        }

        const signedPhotos = await Promise.all(
          Array.from(latestImageDocs.entries()).map(async ([driverId, path]) => {
            const { data } = await supabase.storage.from("driver-documents").createSignedUrl(path, 60 * 60);
            return data?.signedUrl ? ([driverId, data.signedUrl] as const) : null;
          }),
        );
        documentPhotoMap = new Map(signedPhotos.filter((item): item is readonly [string, string] => Boolean(item)));
      }
      return rows.map((r) => ({
        ...r,
        display_photo_url: r.photo_url ?? documentPhotoMap.get(r.user_id) ?? null,
        profiles: profileMap.get(r.user_id) ?? { full_name: null },
      })) as Row[];

    },
  });

  async function review(driverId: string, decision: "approve" | "reject" | "correction", reason?: string) {
    try {
      await review_fn({ data: { driver_id: driverId, decision, reason: reason ?? null } });
      const msg = { approve: "Cadastro aprovado", reject: "Cadastro reprovado", correction: "Correção solicitada" }[decision];
      toast.success(msg);
      setSelected(null);
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const rows = q.data ?? [];

  return (
    <AppShell title="Solicitações de cadastro" subtitle="Motoristas aguardando aprovação">
      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "correction", "rejected", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${filter === k ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}
          >
            {{ pending: "Pendentes", correction: "Correção", rejected: "Reprovados", all: "Todos" }[k]}
          </button>
        ))}
      </div>

      {q.isLoading && <div className="card-soft h-40 animate-pulse bg-surface-2" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.user_id} className="card-soft p-5">
            <div className="flex items-center gap-3">
              {r.display_photo_url ? (
                <img src={r.display_photo_url} alt="Foto do motorista" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.profiles?.full_name ?? "Sem nome"}</div>
                <div className="truncate text-xs text-muted-foreground">{r.city ?? "—"} · {r.phone ?? "—"}</div>
              </div>
              <StatusBadge status={r.approval_status} />
            </div>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <div>CNH: <span className="text-foreground">{r.license_number ?? "—"}</span></div>
              <div>ANTT: <span className="text-foreground">{r.rntrc ?? "—"}</span></div>
              <div>Enviado: <span className="text-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleString("pt-BR") : "—"}</span></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setSelected(r)} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">
                <Eye className="h-3 w-3" /> Visualizar
              </button>
              {(r.approval_status === "pending" || r.approval_status === "correction") && (
                <>
                  <button onClick={() => review(r.user_id, "approve")} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                  </button>
                  <button onClick={() => {
                    const reason = prompt("Motivo da correção:");
                    if (reason) review(r.user_id, "correction", reason);
                  }} className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    <AlertTriangle className="h-3 w-3" /> Correção
                  </button>
                  <button onClick={() => {
                    const reason = prompt("Motivo da reprovação:");
                    if (reason) review(r.user_id, "reject", reason);
                  }} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    <XCircle className="h-3 w-3" /> Reprovar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!q.isLoading && rows.length === 0 && (
          <div className="card-soft col-span-full p-10 text-center text-sm text-muted-foreground">
            Nenhuma solicitação {filter === "pending" ? "pendente" : ""}.
          </div>
        )}
      </div>

      {selected && <DriverDrawer row={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700" },
    correction: { label: "Correção", cls: "bg-orange-500/15 text-orange-700" },
    rejected: { label: "Reprovado", cls: "bg-red-500/15 text-red-700" },
    active: { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-700" },
  };
  const c = map[status] ?? { label: status, cls: "bg-surface-2 text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>{c.label}</span>;
}

function DriverDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
  const docs = useQuery({
    queryKey: ["driver-docs-review", row.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_documents")
        .select("*")
        .eq("driver_id", row.user_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function open(path: string) {
    const { data, error } = await supabase.storage.from("driver-documents").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-auto bg-background p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {row.display_photo_url ? (
              <img src={row.display_photo_url} alt="Foto do motorista" className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-surface-2" />
            )}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{row.profiles?.full_name}</h2>
              <p className="truncate text-xs text-muted-foreground">{row.phone} · {row.city}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
        {row.notes && (
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted-foreground">{row.notes}</div>
        )}
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Documentos</h3>
        <ul className="mt-2 space-y-2">
          {(docs.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.label ?? d.kind}</span>
              </div>
              <button onClick={() => open(d.file_path)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent">Abrir</button>
            </li>
          ))}
          {(docs.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">Sem documentos.</li>}
        </ul>
      </aside>
    </div>
  );
}
