import { AlertTriangle, CheckCircle2, Info, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brl, type AnttCalculation } from "@/lib/antt";

export type AnttCardProps = {
  calc: AnttCalculation | null;
  loading?: boolean;
  negotiated: number;
  tolls: number;
  extraCosts: number;
  margin: number;
  onUseSuggested?: (value: number) => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function AnttCard({ calc, loading, negotiated, tolls, extraCosts, margin, onUseSuggested }: AnttCardProps) {
  if (loading || !calc) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
        {loading ? "Calculando sugestão ANTT…" : "Preencha origem, destino e dados do veículo para calcular a sugestão ANTT."}
      </div>
    );
  }

  const floor = calc.minimum_freight;
  const suggested = (floor ?? 0) + tolls + extraCosts + margin;
  const below = calc.applicable && floor !== null && negotiated > 0 && negotiated < floor;
  const above = calc.applicable && floor !== null && negotiated >= floor;
  const warn = calc.status === "missing_rate" || calc.status === "missing_params";

  const tone = below
    ? "border-destructive/40 bg-destructive/5"
    : above
      ? "border-emerald-500/40 bg-emerald-500/5"
      : warn
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border bg-surface";

  return (
    <div className={cn("rounded-2xl border p-5", tone)}>
      <div className="mb-4 flex items-center gap-2">
        <WalletCards className="h-4 w-4 text-brand" />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Sugestão de valor ANTT</h3>
      </div>

      {!calc.applicable ? (
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{calc.not_applicable_reason}</span>
        </div>
      ) : calc.status !== "ok" ? (
        <div className="flex gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{calc.message}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Row label="Distância" value={`${calc.distance_km.toFixed(1)} km`} />
            <Row label="Tipo de carga" value={calc.cargo_class_label} />
            <Row label="Eixos" value={`${calc.axles} eixos`} />
            <Row label="Tabela" value={`Tabela ${calc.table}`} />
            <Row label="CCD" value={`R$ ${calc.ccd?.toFixed(4)}/km`} />
            <Row label="CC" value={brl(calc.cc)} />
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Fórmula</div>
            <div className="mt-1 font-mono text-xs">{calc.formula}</div>
            <div className="mt-2 text-2xl font-bold">{brl(floor)}</div>
            <div className="text-xs text-muted-foreground">
              Piso mínimo ANTT · {brl(calc.minimum_per_km ?? 0)}/km
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <Row label="Piso mínimo ANTT" value={brl(floor)} />
            <Row label="Pedágios" value={brl(tolls)} />
            <Row label="Custos adicionais" value={brl(extraCosts)} />
            <Row label="Margem InfinitLog" value={brl(margin)} />
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm">
              <span className="font-semibold">Valor sugerido</span>
              <span className="text-lg font-bold tabular-nums">{brl(suggested)}</span>
            </div>
            <Row label="Valor informado do frete" value={brl(negotiated)} />
            {negotiated > 0 && calc.distance_km > 0 && (
              <Row label="Negociado por km" value={`${brl(negotiated / calc.distance_km)}/km`} />
            )}
          </div>

          {onUseSuggested && (
            <Button type="button" className="w-full" onClick={() => onUseSuggested(suggested)}>
              Usar valor sugerido
            </Button>
          )}

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
              below ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {below ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {below
              ? `Atenção: valor informado ${brl(negotiated)}, abaixo do piso ${brl(floor)}. Diferença de ${brl((floor ?? 0) - negotiated)}.`
              : negotiated > 0
                ? "Valor informado está acima ou dentro do piso ANTT"
                : "Informe o valor do frete para comparar com o piso ANTT"}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        Fonte: ANTT{calc.regulation ? ` · ${calc.regulation}` : ""}
        {calc.effective_from
          ? ` · Vigência desde ${new Date(`${calc.effective_from}T00:00:00`).toLocaleDateString("pt-BR")}`
          : ""}
      </div>
    </div>
  );
}
