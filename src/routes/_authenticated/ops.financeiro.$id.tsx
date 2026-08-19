import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { getUserRolesCached } from "@/lib/roles";
import { toast } from "sonner";
import {
  PAYMENT_METHODS,
  bankDataComplete,
  dt,
  money,
  paymentBadgeClass,
  paymentStatusLabel,
  type BankSnapshot,
  type PaymentStatus,
} from "@/lib/finance";
import { STATUS_LABEL } from "@/lib/order-status";
import { labelOf, COST_KINDS } from "@/lib/pf";
import { ArrowLeft, AlertTriangle, CheckCircle2, Download, Eye, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/financeiro/$id")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const roles = await getUserRolesCached(user.id);
    if (!roles.includes("admin") && !roles.includes("financeiro")) {
      throw redirect({ to: "/ops/central" });
    }
  },
  head: () => ({
    meta: [{ title: "Análise financeira — InfinitLog" }, { name: "robots", content: "noindex" }],
  }),
  component: PaymentDetail,
});

const REQUIRED_DOCS = [
  { kind: "canhoto", label: "Canhoto" },
  { kind: "comprovante_entrega", label: "Comprovante de entrega" },
  { kind: "nota_fiscal", label: "Nota fiscal" },
];

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

function PaymentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState<string>("");
  const [bonus, setBonus] = useState<string>("");
  const [payMethod, setPayMethod] = useState("pix");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payBank, setPayBank] = useState("");
  const [payAccount, setPayAccount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [scheduled, setScheduled] = useState("");

  const payQ = useQuery({
    queryKey: ["finance-payment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_payments")
        .select("*, orders:order_id(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const pay = payQ.data;
  const order = pay?.orders;
  const driverId = pay?.driver_id as string | null | undefined;

  const driverQ = useQuery({
    enabled: !!driverId,
    queryKey: ["finance-payment-driver", driverId],
    queryFn: async () => {
      const [{ data: prof }, { data: drv }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, whatsapp").eq("id", driverId!).maybeSingle(),
        supabase
          .from("drivers")
          .select("cpf, phone, whatsapp, rntrc, current_vehicle_id")
          .eq("user_id", driverId!)
          .maybeSingle(),
      ]);
      return { ...(prof ?? {}), ...(drv ?? {}) } as any;
    },
  });

  const vehicleId = (order?.vehicle_id as string | null) ?? driverQ.data?.current_vehicle_id ?? null;
  const vehicleQ = useQuery({
    enabled: !!vehicleId,
    queryKey: ["finance-payment-vehicle", vehicleId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("plate, model, brand, vehicle_type, capacity_kg, antt_number")
        .eq("id", vehicleId!)
        .maybeSingle();
      return data as any;
    },
  });

  const costsQ = useQuery({
    enabled: !!pay?.order_id,
    queryKey: ["finance-payment-costs", pay?.order_id],
    queryFn: async () => {
      const { data: prog } = await supabase
        .from("freight_programs")
        .select("id, pf_code, freight_value, payment_method, payment_term")
        .eq("order_id", pay.order_id)
        .maybeSingle();
      if (!prog) return { prog: null, costs: [] as any[] };
      const { data: costs } = await supabase
        .from("freight_costs")
        .select("id, kind, label, amount")
        .eq("program_id", prog.id);
      return { prog, costs: costs ?? [] };
    },
  });

  const docsQ = useQuery({
    enabled: !!pay?.order_id,
    queryKey: ["finance-payment-docs", pay?.order_id],
    queryFn: async () => {
      const [{ data: atts }, { data: delivery }] = await Promise.all([
        supabase
          .from("order_attachments")
          .select("id, kind, label, file_path, created_at")
          .eq("order_id", pay.order_id),
        supabase.from("deliveries").select("*").eq("order_id", pay.order_id).maybeSingle(),
      ]);
      return { atts: atts ?? [], delivery };
    },
  });

  const eventsQ = useQuery({
    queryKey: ["finance-payment-events", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_payment_events")
        .select("*")
        .eq("payment_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const routeQ = useQuery({
    enabled: !!pay?.order_id,
    queryKey: ["finance-payment-route", pay?.order_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("route_summaries")
        .select("total_distance_km, total_minutes")
        .eq("order_id", pay.order_id)
        .maybeSingle();
      return data as any;
    },
  });

  const bank = (pay?.bank_snapshot ?? {}) as BankSnapshot;
  const bankOk = bankDataComplete(bank);

  const extra = useMemo(() => {
    const d = Number(discount || 0);
    const b = Number(bonus || 0);
    const gross = Number(pay?.gross_amount ?? 0);
    const add = Number(pay?.additions_amount ?? 0) + b;
    const disc = Number(pay?.discounts_amount ?? 0) + d;
    return { gross, add, disc, net: gross + add - disc };
  }, [discount, bonus, pay]);

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (!bankOk) list.push("Dados de pagamento incompletos — não é possível aprovar.");
    const missing = REQUIRED_DOCS.filter(
      (d) => !(docsQ.data?.atts ?? []).some((a: any) => a.kind === d.kind),
    );
    const del = docsQ.data?.delivery;
    const hasProof = !!(del?.delivery_photo_url || del?.signature_url || del?.invoice_url);
    if (missing.length && !hasProof) list.push("Documentação incompleta na operação.");
    const planned = Number(order?.distance_km ?? 0);
    const realized = Number(routeQ.data?.total_distance_km ?? 0);
    if (planned > 0 && realized > planned * 1.2) list.push("KM realizado acima do previsto (+20%).");
    if (pay && Number(pay.gross_amount) !== Number(order?.price ?? pay.gross_amount))
      list.push("Divergência entre valor do frete e valor programado.");
    return list;
  }, [bankOk, docsQ.data, order, routeQ.data, pay]);

  async function logEvent(action: string, toStatus: PaymentStatus, reason?: string, notes?: string) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("driver_payment_events").insert({
      payment_id: id,
      actor_id: u.user?.id ?? null,
      actor_name: u.user?.email ?? null,
      action,
      from_status: pay?.status ?? null,
      to_status: toStatus,
      reason: reason ?? null,
      notes: notes ?? null,
    });
  }

  async function setStatus(next: PaymentStatus, patch: Record<string, unknown> = {}, reason?: string) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("driver_payments")
        .update({ status: next, ...patch })
        .eq("id", id);
      if (error) throw error;
      await logEvent(next, next, reason);
      await qc.invalidateQueries({ queryKey: ["finance-payment", id] });
      await qc.invalidateQueries({ queryKey: ["finance-payment-events", id] });
      await qc.invalidateQueries({ queryKey: ["finance-payments"] });
      toast.success(`Status atualizado: ${paymentStatusLabel(next)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!bankOk) {
      toast.error("Dados bancários/PIX incompletos. Aprovação bloqueada.");
      return;
    }
    await setStatus("aprovado", {
      discounts_amount: extra.disc,
      additions_amount: extra.add,
      net_amount: extra.net,
      approved_at: new Date().toISOString(),
      approved_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
  }

  async function reject() {
    const reason = window.prompt("Motivo da devolução/reprovação:");
    if (!reason) return;
    await setStatus("pendencia", { pending_reason: reason }, reason);
  }

  async function registerPayment() {
    if (!payAmount) {
      toast.error("Informe o valor pago.");
      return;
    }
    await setStatus("pago", {
      paid_at: new Date(`${payDate}T12:00:00`).toISOString(),
      paid_amount: Number(payAmount),
      payment_method: payMethod,
      payment_bank: payBank || null,
      payment_account: payAccount || null,
      receipt_url: receipt || null,
      notes: payNotes || null,
      paid_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
  }

  function fileUrl(path: string) {
    const { data } = supabase.storage.from("order-files").getPublicUrl(path);
    return data.publicUrl;
  }

  if (payQ.isLoading || !pay) {
    return (
      <AppShell title="Análise financeira">
        <div className="text-muted-foreground">Carregando…</div>
      </AppShell>
    );
  }

  const docs = docsQ.data?.atts ?? [];

  return (
    <AppShell
      title={`Pagamento — ${order?.code ?? ""}`}
      subtitle={`Entrega em ${dt(pay.delivered_at, true)}`}
      actions={
        <Link
          to="/ops/financeiro"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={paymentBadgeClass(pay.status)}>{paymentStatusLabel(pay.status)}</span>
        <span className="text-sm text-muted-foreground">
          Frete: {STATUS_LABEL[order?.status ?? ""] ?? "—"}
        </span>
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a) => (
            <div
              key={a}
              className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {a}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section title="Dados do frete">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Número" value={order?.code} />
              <Field label="Cliente" value={order?.client_name} />
              <Field label="Pedido/OC" value={order?.invoice_number} />
              <Field label="CT-e" value={order?.cte_number} />
              <Field label="MDF-e" value={order?.mdfe_number} />
              <Field label="Coleta" value={dt(order?.started_at ?? order?.pickup_window_start, true)} />
              <Field label="Entrega" value={dt(pay.delivered_at, true)} />
              <Field label="Origem" value={`${order?.origin_city ?? "—"}/${order?.origin_state ?? ""}`} />
              <Field
                label="Destino"
                value={`${order?.destination_city ?? "—"}/${order?.destination_state ?? ""}`}
              />
              <Field label="KM previsto" value={order?.distance_km ?? "—"} />
              <Field
                label="KM realizado"
                value={routeQ.data?.total_distance_km ?? "—"}
              />
              <Field label="Peso" value={order?.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : "—"} />
              <Field label="Volumes" value={order?.volumes} />
              <Field label="Tipo de carga" value={order?.cargo_type} />
              <Field label="Valor da NF" value={money(order?.invoice_value)} />
            </div>
          </Section>

          <Section title="Dados do motorista">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Nome" value={driverQ.data?.full_name} />
              <Field label="CPF" value={driverQ.data?.cpf} />
              <Field label="Telefone" value={driverQ.data?.phone} />
              <Field label="WhatsApp" value={driverQ.data?.whatsapp} />
              <Field label="RNTRC/ANTT" value={driverQ.data?.rntrc ?? vehicleQ.data?.antt_number} />
              <Field label="Veículo" value={vehicleQ.data?.vehicle_type} />
              <Field label="Modelo" value={`${vehicleQ.data?.brand ?? ""} ${vehicleQ.data?.model ?? ""}`.trim() || "—"} />
              <Field label="Placa" value={vehicleQ.data?.plate} />
              <Field label="Capacidade" value={vehicleQ.data?.capacity_kg ? `${vehicleQ.data.capacity_kg} kg` : "—"} />
            </div>
          </Section>

          <Section
            title="Dados para pagamento"
            right={
              bankOk ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Completos
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" /> Incompletos
                </span>
              )
            }
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Titular" value={bank.favored_name} />
              <Field label="CPF/CNPJ" value={bank.favored_document} />
              <Field label="Banco" value={bank.bank_name} />
              <Field label="Agência" value={bank.bank_agency} />
              <Field
                label="Conta"
                value={bank.bank_account ? `${bank.bank_account}${bank.bank_account_digit ? "-" + bank.bank_account_digit : ""}` : "—"}
              />
              <Field label="Tipo de conta" value={bank.bank_account_type} />
              <Field label="PIX" value={bank.pix_key} />
              <Field label="Tipo de chave" value={bank.pix_key_type} />
              <Field label="Registrado em" value={dt(bank.snapshot_at, true)} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Dados congelados no momento da entrega — alterações posteriores do motorista não afetam
              este pagamento.
            </p>
          </Section>

          <Section title="Documentos da operação">
            <ul className="space-y-2">
              {REQUIRED_DOCS.map((d) => {
                const found = docs.find((a: any) => a.kind === d.kind);
                return (
                  <li
                    key={d.kind}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" /> {d.label}
                    </span>
                    {found ? (
                      <span className="flex items-center gap-3">
                        <span className="text-xs font-medium text-emerald-700">✓ Recebido</span>
                        <a href={fileUrl(found.file_path)} target="_blank" rel="noreferrer" className="text-brand">
                          <Eye className="h-4 w-4" />
                        </a>
                        <a href={fileUrl(found.file_path)} download className="text-brand">
                          <Download className="h-4 w-4" />
                        </a>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700">⚠ Pendente</span>
                    )}
                  </li>
                );
              })}
              {docs
                .filter((a: any) => !REQUIRED_DOCS.some((r) => r.kind === a.kind))
                .map((a: any) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" /> {a.label ?? a.kind}
                    </span>
                    <span className="flex items-center gap-3">
                      <a href={fileUrl(a.file_path)} target="_blank" rel="noreferrer" className="text-brand">
                        <Eye className="h-4 w-4" />
                      </a>
                      <a href={fileUrl(a.file_path)} download className="text-brand">
                        <Download className="h-4 w-4" />
                      </a>
                    </span>
                  </li>
                ))}
              {docsQ.data?.delivery && (
                <li className="rounded-xl border border-border px-3 py-2 text-sm">
                  <div className="mb-2 font-medium">Comprovação de entrega</div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {[
                      ["Foto da coleta", docsQ.data.delivery.pickup_photo_url],
                      ["Foto da entrega", docsQ.data.delivery.delivery_photo_url],
                      ["Assinatura", docsQ.data.delivery.signature_url],
                      ["Nota fiscal", docsQ.data.delivery.invoice_url],
                    ].map(([label, url]: any) =>
                      url ? (
                        <a key={label} href={url} target="_blank" rel="noreferrer" className="text-brand underline">
                          {label}
                        </a>
                      ) : (
                        <span key={label} className="text-amber-700">
                          ⚠ {label}
                        </span>
                      ),
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Recebedor: {docsQ.data.delivery.receiver_name ?? "—"} ·{" "}
                    {docsQ.data.delivery.receiver_document ?? "—"}
                  </div>
                </li>
              )}
            </ul>
          </Section>

          <Section title="Histórico / auditoria">
            <ol className="space-y-3">
              {(eventsQ.data ?? []).map((e: any) => (
                <li key={e.id} className="border-l-2 border-border pl-3 text-sm">
                  <div className="font-medium">
                    {paymentStatusLabel(e.to_status) !== "—" ? paymentStatusLabel(e.to_status) : e.action}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dt(e.created_at, true)} · {e.actor_name ?? "sistema"}
                  </div>
                  {e.reason && <div className="mt-1 text-xs text-amber-700">Motivo: {e.reason}</div>}
                  {e.notes && <div className="mt-1 text-xs text-muted-foreground">{e.notes}</div>}
                </li>
              ))}
              {(eventsQ.data ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Sem registros.</li>
              )}
            </ol>
          </Section>
        </div>

        {/* Coluna de ações */}
        <div className="space-y-5">
          <Section title="Valores">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor combinado</span>
                <span className="font-semibold">{money(extra.gross)}</span>
              </div>
              {(costsQ.data?.costs ?? [])
                .filter((c: any) => c.kind !== "frete")
                .map((c: any) => (
                  <div key={c.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {c.label || labelOf(COST_KINDS, c.kind)}
                    </span>
                    <span>{money(Number(c.amount))}</span>
                  </div>
                ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adicionais</span>
                <span>{money(extra.add)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Descontos</span>
                <span>-{money(extra.disc)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base">
                <span className="font-semibold">Valor final</span>
                <span className="font-bold text-brand">{money(extra.net)}</span>
              </div>
            </div>

            {pay.status !== "pago" && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs">
                  Bonificação
                  <input
                    type="number"
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    placeholder="0,00"
                  />
                </label>
                <label className="text-xs">
                  Desconto
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    placeholder="0,00"
                  />
                </label>
              </div>
            )}
          </Section>

          {pay.status !== "pago" && pay.status !== "cancelado" && (
            <Section title="Análise">
              <div className="space-y-2">
                {pay.status === "aguardando_analise" && (
                  <button
                    disabled={busy}
                    onClick={() => setStatus("em_conferencia")}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    Iniciar conferência
                  </button>
                )}
                {pay.status === "pendencia" && (
                  <button
                    disabled={busy}
                    onClick={() => setStatus("devolvido")}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    Devolver para conferência
                  </button>
                )}
                <button
                  disabled={busy || !bankOk}
                  onClick={approve}
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  ✓ Aprovar pagamento
                </button>
                <button
                  disabled={busy}
                  onClick={reject}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700"
                >
                  ✕ Reprovar / devolver
                </button>
                {pay.status === "aprovado" && (
                  <div className="pt-2">
                    <label className="text-xs">
                      Agendar pagamento para
                      <input
                        type="date"
                        value={scheduled}
                        onChange={(e) => setScheduled(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      disabled={busy || !scheduled}
                      onClick={() => setStatus("agendado", { scheduled_for: scheduled })}
                      className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      Agendar
                    </button>
                  </div>
                )}
              </div>
            </Section>
          )}

          {["aprovado", "agendado"].includes(pay.status) && (
            <Section title="Registrar pagamento">
              <div className="space-y-3 text-xs">
                <label className="block">
                  Data
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  Valor pago
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(extra.net)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  Forma de pagamento
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Banco utilizado
                  <input
                    value={payBank}
                    onChange={(e) => setPayBank(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  Conta utilizada
                  <input
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  Link do comprovante
                  <input
                    value={receipt}
                    onChange={(e) => setReceipt(e.target.value)}
                    placeholder="https://…"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  Observações
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={registerPayment}
                  className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                >
                  Registrar pagamento
                </button>
              </div>
            </Section>
          )}

          {pay.status === "pago" && (
            <Section title="Pagamento realizado">
              <div className="space-y-2">
                <Field label="Data" value={dt(pay.paid_at, true)} />
                <Field label="Valor pago" value={money(pay.paid_amount)} />
                <Field label="Forma" value={pay.payment_method} />
                <Field label="Banco" value={pay.payment_bank} />
                <Field label="Conta" value={pay.payment_account} />
                {pay.receipt_url && (
                  <a href={pay.receipt_url} target="_blank" rel="noreferrer" className="text-sm text-brand underline">
                    Ver comprovante
                  </a>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
