import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { brl, type AnttCalculation } from "@/lib/antt";
import { isBodyCompatible, type FreightVehicleConfiguration } from "@/lib/vehicle-antt";

export interface VehicleCatalogProps {
  configurations: FreightVehicleConfiguration[];
  calculations: Record<string, AnttCalculation>;
  selected: FreightVehicleConfiguration | null;
  loading: boolean;
  error: boolean;
  distance: number;
  bodyTypes: string[];
  bodyType: string;
  onSelect: (configuration: FreightVehicleConfiguration) => void;
  onBodySelect: (body: string) => void;
}

function TruckSilhouette({ articulated }: { articulated: boolean }) {
  return <svg viewBox="0 0 120 44" className="h-10 w-16 shrink-0 text-foreground sm:w-20" aria-hidden="true">
    <path fill="currentColor" d="M4 17h13l8 9v10H3V23zm4 3v7h13l-6-7zM28 8h57v23H28zm0 25h61v3H28z" fillRule="evenodd" />
    {articulated && <path fill="currentColor" d="M90 9h27v22H90zm-1 24h28v3H89z" />}
    <g fill="currentColor"><circle cx="13" cy="36" r="5"/><circle cx="36" cy="36" r="5"/><circle cx="73" cy="36" r="5"/><circle cx="83" cy="36" r="5"/>{articulated && <><circle cx="102" cy="36" r="5"/><circle cx="112" cy="36" r="5"/></>}</g>
  </svg>;
}

export function VehicleCatalog(props: VehicleCatalogProps) {
  const [compareAll, setCompareAll] = useState(false);
  const visible = compareAll ? props.configurations : props.configurations.filter((item, index) => index < 7 || item.key === props.selected?.key);
  return <section className="mb-8 bg-surface py-3" aria-label="Comparação de veículos pesados">
    <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <h2 className="min-w-0 text-xl font-semibold">Pesados</h2>
      <label className="flex max-w-44 items-center gap-2 text-xs sm:max-w-none sm:text-sm">
        <Checkbox checked={compareAll} onCheckedChange={(value) => setCompareAll(value === true)} />
        Selecionar todos pesados
      </label>
    </header>
    {props.error && <p role="alert" className="mb-3 text-sm text-destructive">Não foi possível consultar as configurações ou os valores ANTT.</p>}
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {visible.map((vehicle) => {
        const calculation = props.calculations[vehicle.key];
        const price = calculation?.status === "ok" ? calculation.minimum_freight : null;
        const status = props.loading ? "Calculando…" : !props.distance ? "Preencha os dados da rota" : !vehicle.axles ? "Eixos não cadastrados" : calculation?.status === "not_applicable" ? "Não aplicável" : calculation?.status === "missing_rate" ? "Sem coeficiente vigente" : "Aguardando dados do frete";
        const selected = props.selected?.key === vehicle.key;
        return <Button key={vehicle.key} type="button" variant="outline" aria-pressed={selected}
          onClick={() => props.onSelect(vehicle)}
          className={cn("grid h-auto min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,7rem)] items-center gap-2 whitespace-normal rounded-lg p-3 text-left sm:gap-3", selected ? "border-brand bg-brand/5 ring-1 ring-brand/30 hover:bg-brand/10" : "border-border bg-surface hover:border-brand/50")}>
          <TruckSilhouette articulated={(vehicle.axles ?? 0) >= 7} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{vehicle.label}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{vehicle.axles ? `${vehicle.axles} eixos` : "Configuração pendente"}</span>
            {vehicle.capacity && <span className="block text-xs font-normal text-muted-foreground">até {(vehicle.capacity / 1000).toLocaleString("pt-BR")} t</span>}
          </span>
          <span className="min-w-0 text-right">
            <span className="block text-[11px] font-normal text-muted-foreground">Valor ANTT</span>
            <span className={cn("mt-1 block tabular-nums", price != null ? "text-sm font-bold sm:text-base" : "text-[11px] font-normal text-muted-foreground")}>{price != null ? brl(price) : status}</span>
          </span>
        </Button>;
      })}
    </div>
    <div className="mt-7 border-t border-border pt-5">
      <h3 className="mb-3 text-sm font-semibold">Selecione o tipo de carroceria</h3>
      <div className="flex flex-wrap gap-2">
        {props.bodyTypes.map((body) => <Button key={body} type="button" variant="outline" size="sm"
          disabled={!isBodyCompatible(props.selected, body)} aria-pressed={props.bodyType === body}
          className={cn("rounded-lg", props.bodyType === body && "border-brand bg-brand/5 text-brand")}
          onClick={() => props.onBodySelect(body)}>{body}</Button>)}
      </div>
      {!isBodyCompatible(props.selected, props.bodyType) && <p className="mt-2 text-sm text-destructive">Escolha uma carroceria compatível com a configuração selecionada.</p>}
    </div>
  </section>;
}