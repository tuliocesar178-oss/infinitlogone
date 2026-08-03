import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import {
  brl,
  COST_KINDS,
  labelOf,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  type CostKind,
} from "@/lib/pf";
import { FreightProgramPDF } from "@/components/pf-pdf";
import { FileDown, Plus, Send, Trash2 } from "lucide-react";
import { DRIVER_COLUMNS } from "@/lib/driver-columns";
import { sendProgramToDriver } from "@/lib/freight.functions";
import { useServerFn } from "@tanstack/react-start";

export function FreightProgramPanel({ order }: { order: any }) {
  const qc = useQueryClient();
  const sendProgram = useServerFn(sendProgramToDriver);
  const orderId = order.id;

  const q = useQuery({
    queryKey: ["pf", orderId],
    queryFn: async () => {
      const { data: program, error } = await supabase
        .from("freight_programs")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!program) return { program: null, costs: [] as any[] };
      const { data: costs } = await supabase
        .from("freight_costs")
        .select("*")
        .eq("program_id", program.id)
        .order("created_at");
      return { program, costs: costs ?? [] };
    },
  });

  const availableDrivers = useQuery({
    queryKey: ["drivers-available"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select(
          "user_id, city, financial_status, profiles:profiles!inner(full_name)",
        )
        .in("financial_status", ["ativo"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [newCost, setNewCost] = useState<{ kind: CostKind; label: string; amount: string }>({
    kind: "frete",
    label: "",
    amount: "",
  });
  const [driverId, setDriverId] = useState("");
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (q.data?.program) setForm(q.data.program);
  }, [q.data?.program]);

  const total = useMemo(
    () => (q.data?.costs ?? []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
    [q.data?.costs],
  );

  async function saveProgram() {
    if (!q.data?.program) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("freight_programs")
        .update({
          freight_value: form.freight_value ? Number(form.freight_value) : null,
          payment_method: form.payment_method || null,
          payment_term: form.payment_term || null,
          payment_notes: form.payment_notes || null,
        })
        .eq("id", q.data.program.id);
      if (error) throw error;
      toast.success("Programação salva");
      qc.invalidateQueries({ queryKey: ["pf", orderId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function addCost() {
    if (!q.data?.program || !newCost.amount) return;
    const { error } = await supabase.from("freight_costs").insert({
      program_id: q.data.program.id,
      kind: newCost.kind,
      label: newCost.label || null,
      amount: Number(newCost.amount),
    });
    if (error) return toast.error(error.message);
    setNewCost({ kind: "frete", label: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["pf", orderId] });
  }

  async function removeCost(id: string) {
    const { error } = await supabase.from("freight_costs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pf", orderId] });
  }

  async function sendToDriver() {
    if (!q.data?.program || !driverId) {
      toast.warning("Selecione um motorista.");
      return;
    }
    if (!form.freight_value) {
      toast.warning("Informe o valor do frete antes de enviar.");
      return;
    }
    setSending(true);
    try {
      await saveProgram();
      await sendProgram({
        data: {
          program_id: q.data.program.id,
          driver_id: driverId,
          price: Number(form.freight_value),
          expires_minutes: 15,
        },
      });
      toast.success("Programação enviada ao motorista");
      qc.invalidateQueries({ queryKey: ["pf", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function downloadPDF() {
    if (!q.data?.program) return;
    setDownloading(true);
    try {
      const program = q.data.program;
      // fetch driver + vehicle if assigned
      let driver: any = null;
      let driverProfile: any = null;
      let vehicle: any = null;
      const targetDriverId = order.driver_id ?? driverId;
      if (targetDriverId) {
        const [{ data: d }, { data: p }] = await Promise.all([
          supabase.from("drivers").select(DRIVER_COLUMNS).eq("user_id", targetDriverId).maybeSingle(),
          supabase.from("profiles").select("*").eq("id", targetDriverId).maybeSingle(),
        ]);
        driver = d;
        driverProfile = p;
        if (d?.current_vehicle_id) {
          const { data: v } = await supabase
            .from("vehicles")
            .select("*")
            .eq("id", d.current_vehicle_id)
            .maybeSingle();
          vehicle = v;
        }
      }
      let responsibleName: string | null = null;
      if (program.responsible_id) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", program.responsible_id)
          .maybeSingle();
        responsibleName = data?.full_name ?? null;
      }
      const trackingUrl = `https://rastreio.infinitlog.com.br/${order.tracking_code}`;
      const qrDataUrl = await QRCode.toDataURL(trackingUrl, { width: 320, margin: 1 });
      const doc = (
        <FreightProgramPDF
          program={program}
          order={order}
          driver={driver}
          driverProfile={driverProfile}
          vehicle={vehicle}
          costs={(q.data?.costs ?? []).map((c: any) => ({
            kind: labelOf(COST_KINDS, c.kind),
            label: c.label,
            amount: c.amount,
          }))}
          responsibleName={responsibleName}
          qrDataUrl={qrDataUrl}
          trackingUrl={trackingUrl}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${program.pf_code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  }

  if (q.isLoading) return <div className="card-soft h-64 animate-pulse bg-surface-2" />;
  const program = q.data?.program;
  if (!program) {
    return (
      <section className="card-soft p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Programação de Frete
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          A programação será criada automaticamente ao cadastrar o pedido.
        </p>
      </section>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-amber-100 text-amber-700",
    accepted: "bg-emerald-100 text-emerald-700",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-slate-200 text-slate-600",
  };
  const statusLabel: Record<string, string> = {
    draft: "Rascunho",
    sent: "Enviada ao motorista",
    accepted: "Aceita",
    declined: "Recusada",
    cancelled: "Cancelada",
  };

  return (
    <section className="card-soft p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Programação de Frete
          </h2>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-lg font-semibold">{program.pf_code}</span>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-medium ${statusColors[program.status]}`}
            >
              {statusLabel[program.status]}
            </span>
          </div>
        </div>
        <button
          onClick={downloadPDF}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
        >
          <FileDown className="h-4 w-4" /> {downloading ? "Gerando…" : "PDF oficial"}
        </button>
      </header>

      {/* Costs */}
      <div className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Custos da operação
        </h3>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
          {(q.data?.costs ?? []).map((c: any) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{labelOf(COST_KINDS, c.kind)}</div>
                {c.label && (
                  <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{brl(Number(c.amount))}</span>
                <button
                  onClick={() => removeCost(c.id)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover custo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {(q.data?.costs ?? []).length === 0 && (
            <li className="px-4 py-4 text-sm text-muted-foreground">Nenhum custo lançado.</li>
          )}
          <li className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="text-base font-bold">{brl(total)}</span>
          </li>
        </ul>

        <div className="mt-3 grid grid-cols-[1fr_2fr_140px_auto] gap-2">
          <select
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            value={newCost.kind}
            onChange={(e) => setNewCost({ ...newCost, kind: e.target.value as CostKind })}
          >
            {COST_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <input
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            placeholder="Descrição (opcional)"
            value={newCost.label}
            onChange={(e) => setNewCost({ ...newCost, label: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            placeholder="Valor"
            value={newCost.amount}
            onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })}
          />
          <button
            onClick={addCost}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Payment */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Valor do frete (motorista)
          </span>
          <input
            type="number"
            step="0.01"
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            value={form.freight_value ?? ""}
            onChange={(e) => setForm({ ...form, freight_value: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Forma de pagamento
          </span>
          <select
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            value={form.payment_method ?? ""}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          >
            <option value="">—</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Prazo
          </span>
          <select
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            value={form.payment_term ?? ""}
            onChange={(e) => setForm({ ...form, payment_term: e.target.value })}
          >
            <option value="">—</option>
            {PAYMENT_TERMS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Observações do pagamento
          </span>
          <textarea
            rows={2}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none"
            value={form.payment_notes ?? ""}
            onChange={(e) => setForm({ ...form, payment_notes: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={saveProgram}
          disabled={saving}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar programação"}
        </button>
      </div>

      {/* Send to driver */}
      {program.status === "draft" && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Enviar ao motorista
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="h-11 min-w-[240px] flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
            >
              <option value="">— selecionar motorista —</option>
              {availableDrivers.data?.map((d: any) => (
                <option key={d.user_id} value={d.user_id}>
                  {d.profiles?.full_name ?? "Sem nome"}
                  {d.city ? ` · ${d.city}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={sendToDriver}
              disabled={sending || !driverId}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {sending ? "Enviando…" : "Enviar programação"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            O motorista receberá a oferta com todos os dados operacionais e financeiros. Aceite
            imediato inicia o deslocamento.
          </p>
        </div>
      )}
    </section>
  );
}
