import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { inviteDriver } from "@/lib/drivers.functions";

export function DriverInviteDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (userId: string) => void;
}) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteDriver);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    cpf: "",
    city: "",
    state: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await invite({
        data: {
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          cpf: form.cpf || null,
          city: form.city || null,
          state: form.state || null,
        },
      });
      toast.success("Convite enviado por e-mail");
      qc.invalidateQueries({ queryKey: ["drivers-list"] });
      onCreated?.(res.user_id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao convidar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Novo motorista</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Nome completo" required className="sm:col-span-2">
            <input
              className="input"
              required
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </Field>
          <Field label="E-mail" required className="sm:col-span-2">
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="CPF">
            <input className="input" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <input
              className="input"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
          <Field label="UF">
            <input
              className="input"
              maxLength={2}
              value={form.state}
              onChange={(e) => set("state", e.target.value.toUpperCase())}
            />
          </Field>
          <div className="sm:col-span-2 mt-2 flex justify-end gap-3">
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

function Field({
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
