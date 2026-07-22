import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({ meta: [{ title: "Motorista — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: DriverDashboard,
});

type Status = "available" | "on_trip" | "offline";

function DriverDashboard() {
  const [name, setName] = useState<string>("");
  const [status, setStatus] = useState<Status>("offline");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: profile }, { data: driver }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle(),
        supabase.from("drivers").select("status").eq("user_id", u.user.id).maybeSingle(),
      ]);
      setName(profile?.full_name ?? u.user.email ?? "Motorista");
      if (driver?.status) setStatus(driver.status as Status);
    })();
  }, []);

  async function updateStatus(next: Status) {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("drivers")
        .upsert(
          { user_id: u.user.id, status: next, last_seen_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      setStatus(next);
      toast.success("Status atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title={`Olá, ${name.split(" ")[0]}`} subtitle="Bem-vindo ao painel do motorista.">
      <div className="mx-auto max-w-lg">
        <div className="card-soft p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Status
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1.5">
            {(["available", "on_trip", "offline"] as Status[]).map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => updateStatus(s)}
                className={`rounded-xl px-3 py-3 text-sm font-medium transition ${
                  status === s
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "available" && "Disponível"}
                {s === "on_trip" && "Em viagem"}
                {s === "offline" && "Offline"}
              </button>
            ))}
          </div>
        </div>

        <div className="card-soft mt-6 grid place-items-center p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {status === "available"
              ? "Aguardando novas ofertas de frete…"
              : status === "on_trip"
              ? "Você está em uma viagem ativa."
              : "Fique offline até estar pronto para receber ofertas."}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
