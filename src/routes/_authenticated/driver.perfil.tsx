import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AVAILABILITY, labelOf } from "@/lib/pf";
import { applyTheme, readTheme, type ThemeMode } from "@/lib/driver-prefs";
import { AlertTriangle, Bell, ChevronRight, Clock, LogOut, MapPin, Moon, Phone, Star, Sun, Truck, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverProfile,
});

function DriverProfile() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => (typeof window === "undefined" ? "light" : readTheme()));
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-profile-page", userId],
    queryFn: async () => {
      const [{ data: profile }, { data: driver }, { data: vehicle }, { data: notifs }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, avatar_url").eq("id", userId).maybeSingle(),
        supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("vehicles").select("plate, brand, model, vehicle_type, color").eq("owner_driver_id", userId).limit(1).maybeSingle(),
        supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      ]);
      return { profile, driver, vehicle, notifs: notifs ?? [] };
    },
  });

  async function setAvailability(a: string) {
    try {
      const { error } = await supabase.from("drivers").update({ availability: a } as never).eq("user_id", userId);
      if (error) throw error;
      toast.success("Disponibilidade atualizada");
      qc.invalidateQueries({ queryKey: ["driver-profile-page", userId] });
      qc.invalidateQueries({ queryKey: ["driver-me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const p = q.data?.profile;
  const d = q.data?.driver;
  const v = q.data?.vehicle;
  const notifs = q.data?.notifs ?? [];

  return (
    <div className="space-y-6">
      <div className="card-soft p-6">
        <div className="flex items-center gap-4">
          {d?.photo_url || p?.avatar_url ? (
            <img src={d?.photo_url ?? p?.avatar_url ?? undefined} alt="" className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-surface-2">
              <UserRound className="h-8 w-8 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{p?.full_name ?? "—"}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {[d?.city, d?.state].filter(Boolean).join(", ") || "—"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {p?.phone ?? d?.phone ?? "—"}
            </div>
            {d?.rating && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" />
                {Number(d.rating).toFixed(1)}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="card-soft p-5">
        <SectionTitle>Disponibilidade</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {AVAILABILITY.map((a) => (
            <button key={a.value} onClick={() => setAvailability(a.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                d?.availability === a.value
                  ? "bg-brand text-brand-foreground ring-brand"
                  : (d?.availability === ("available" as any) && a.value === "disponivel")
                    ? "bg-brand text-brand-foreground ring-brand"
                    : "bg-surface text-muted-foreground ring-border hover:bg-accent"
              }`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">Atual: {labelOf(AVAILABILITY as any, d?.availability)}</div>
      </section>

      <section className="card-soft p-5">
        <SectionTitle>Meu veículo</SectionTitle>
        {v ? (
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <div className="font-semibold">{v.plate} · {v.brand ?? ""} {v.model ?? ""}</div>
              <div className="text-xs text-muted-foreground">
                {v.vehicle_type ?? "—"}{v.color ? ` · ${v.color}` : ""}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhum veículo vinculado ao seu cadastro.</div>
        )}
      </section>

      <section className="card-soft p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand" />
          <SectionTitle>Notificações</SectionTitle>
        </div>
        {notifs.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem notificações recentes.</div>
        ) : (
          <ul className="space-y-2">
            {notifs.map((n: any) => (
              <li key={n.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft p-5">
        <SectionTitle>Aparência</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {(["light", "dark"] as ThemeMode[]).map((m) => {
            const active = theme === m;
            const Icon = m === "dark" ? Moon : Sun;
            return (
              <button
                key={m}
                onClick={() => { setTheme(m); applyTheme(m); }}
                className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold ring-1 ring-inset ${
                  active ? "bg-brand text-brand-foreground ring-brand" : "bg-surface text-muted-foreground ring-border"
                }`}
              >
                <Icon className="h-4 w-4" /> {m === "dark" ? "Escuro" : "Claro"}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Ideal para dirigir à noite.</p>
      </section>

      <section className="card-soft divide-y divide-border">
        <Link to="/driver/ofertas/historico" className="flex items-center gap-3 p-4 hover:bg-accent">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"><Clock className="h-4 w-4 text-muted-foreground" /></span>
          <div className="flex-1">
            <div className="text-sm font-semibold">Histórico de ofertas</div>
            <div className="text-xs text-muted-foreground">Aceitas, recusadas e expiradas.</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/driver/ocorrencias" className="flex items-center gap-3 p-4 hover:bg-accent">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100"><AlertTriangle className="h-4 w-4 text-amber-700" /></span>
          <div className="flex-1">
            <div className="text-sm font-semibold">Ocorrências</div>
            <div className="text-xs text-muted-foreground">Reportar problemas para a logística.</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      <button onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100">
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}
