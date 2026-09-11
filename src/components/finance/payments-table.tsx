import { formatBRL } from "@/lib/ops-central";
import { PAYMENT_STATUS_LABEL, paymentStatusChip, type DriverPaymentStatus } from "@/lib/finance";
import { Link } from "@tanstack/react-router";

export type PaymentRow = {
  id: string;
  order_id: string;
  status: DriverPaymentStatus;
  gross_amount: number;
  discounts_amount: number;
  additions_amount: number;
  net_amount: number;
  paid_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  driver_name: string;
  order_code: string;
  client_name: string | null;
};

function date(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhum pagamento encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Frete</th>
            <th className="px-4 py-3 text-left font-medium">Motorista</th>
            <th className="px-4 py-3 text-right font-medium">Bruto</th>
            <th className="px-4 py-3 text-right font-medium">Desc./Acrésc.</th>
            <th className="px-4 py-3 text-right font-medium">Líquido</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Pago / Agendado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/70 hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link
                  to="/ops/pedidos/$id"
                  params={{ id: r.order_id }}
                  className="font-medium text-primary hover:underline"
                >
                  {r.order_code}
                </Link>
                <p className="text-xs text-muted-foreground">{r.client_name ?? "—"}</p>
              </td>
              <td className="px-4 py-3">{r.driver_name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatBRL(r.gross_amount)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                -{formatBRL(r.discounts_amount)} / +{formatBRL(r.additions_amount)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(r.net_amount)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${paymentStatusChip(r.status)}`}>
                  {PAYMENT_STATUS_LABEL[r.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.paid_at ? date(r.paid_at) : date(r.scheduled_for)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
