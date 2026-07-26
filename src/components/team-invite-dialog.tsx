import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inviteTeamMember } from "@/lib/team.functions";
import { TEAM_ROLES } from "@/lib/team";

export function TeamInviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteTeamMember);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    whatsapp: "",
    cpf: "",
    rg: "",
    position: "",
    department_id: "",
    role: "operacional" as (typeof TEAM_ROLES)[number]["value"],
  });

  const depts = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open)
      setForm({
        email: "",
        full_name: "",
        phone: "",
        whatsapp: "",
        cpf: "",
        rg: "",
        position: "",
        department_id: "",
        role: "operacional",
      });
  }, [open]);

  if (!open) return null;

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await invite({
        data: {
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          cpf: form.cpf || null,
          rg: form.rg || null,
          position: form.position || null,
          department_id: form.department_id || null,
          role: form.role,
        },
      });
      toast.success("Convite enviado por e-mail");
      qc.invalidateQueries({ queryKey: ["team-list"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao convidar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Novo colaborador</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2">
          <F label="Nome completo" required className="sm:col-span-2">
            <input className="input" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </F>
          <F label="E-mail" required>
            <input type="email" className="input" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          </F>
          <F label="Cargo">
            <input className="input" value={form.position} onChange={(e) => set("position", e.target.value)} />
          </F>
          <F label="Departamento">
            <select className="input" value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">— selecionar —</option>
              {(depts.data ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </F>
          <F label="Perfil de acesso" required>
            <select className="input" value={form.role} onChange={(e) => set("role", e.target.value as any)}>
              {TEAM_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.desc}
                </option>
              ))}
            </select>
          </F>
          <F label="Telefone">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </F>
          <F label="WhatsApp">
            <input className="input" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </F>
          <F label="CPF">
            <input className="input" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
          </F>
          <F label="RG">
            <input className="input" value={form.rg} onChange={(e) => set("rg", e.target.value)} />
          </F>
          <div className="sm:col-span-2 mt-2 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              Um e-mail com link de acesso será enviado ao colaborador.
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border bg-background px-5 py-2.5 text-sm hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </div>
        </form>
        <style>{`
          .input { width:100%; height:2.75rem; padding:0 .9rem; border-radius:.9rem;
            border:1px solid var(--color-border); background:var(--color-surface); font-size:.9rem; outline:none; }
          .input:focus { border-color: var(--color-brand); }
        `}</style>
      </div>
    </div>
  );
}

function F({
  label,
  children,
  required,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
