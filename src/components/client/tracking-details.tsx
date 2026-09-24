import { BadgeCheck, Camera, CircleUserRound, Gauge, Truck } from "lucide-react";
import type { TrackingDriver, TrackingVehicle } from "@/lib/client-tracking";
import { vehicleName } from "@/lib/client-tracking";

interface DriverDetailsProps {
  driver: TrackingDriver | null;
}

export function DriverDetails({ driver }: DriverDetailsProps) {
  return (
    <section className="card-soft p-5 sm:p-6" aria-labelledby="driver-heading">
      <div className="flex items-center gap-2">
        <CircleUserRound className="h-5 w-5 text-brand" />
        <h2 id="driver-heading" className="text-sm font-bold uppercase text-muted-foreground">Motorista</h2>
      </div>
      {!driver ? (
        <EmptyAssignment icon={<CircleUserRound className="h-7 w-7" />} text="Aguardando definição do motorista" />
      ) : (
        <div className="mt-5 flex items-center gap-4">
          {driver.photo_url ? (
            <img src={driver.photo_url} alt={`Foto de ${driver.name ?? "motorista"}`} className="h-20 w-20 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-secondary text-2xl font-semibold text-primary">
              {(driver.name ?? "M").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{driver.name ?? "Motorista responsável"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Motorista responsável pelo frete</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success" /> Em operação
              </span>
              {driver.license_category && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">CNH {driver.license_category}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface VehicleDetailsProps {
  vehicle: TrackingVehicle | null;
}

export function VehicleDetails({ vehicle }: VehicleDetailsProps) {
  const details = vehicle
    ? [
        ["Tipo", vehicle.vehicle_type], ["Marca", vehicle.brand], ["Modelo", vehicle.model],
        ["Ano", vehicle.year], ["Placa", vehicle.plate], ["Cor", vehicle.color],
        ["Capacidade", vehicle.capacity_kg != null ? `${vehicle.capacity_kg.toLocaleString("pt-BR")} kg` : null],
        ["Eixos", vehicle.axles != null ? `${vehicle.axles}` : null], ["Carroceria", vehicle.body_type],
      ].filter((item) => item[1] !== null && item[1] !== "")
    : [];

  return (
    <section className="card-soft overflow-hidden" aria-labelledby="vehicle-heading">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-brand" />
          <h2 id="vehicle-heading" className="text-sm font-bold uppercase text-muted-foreground">Veículo</h2>
        </div>
        {!vehicle ? (
          <EmptyAssignment icon={<Truck className="h-7 w-7" />} text="Aguardando definição do veículo" />
        ) : (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(180px,0.8fr)_1fr]">
              <div className="aspect-[16/10] overflow-hidden rounded-lg bg-secondary">
                {vehicle.photo_url ? (
                  <img src={vehicle.photo_url} alt={vehicleName(vehicle)} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground"><Camera className="h-8 w-8" /></div>
                )}
              </div>
              <div className="self-center">
                <p className="text-xl font-semibold">{vehicleName(vehicle)}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-brand">{vehicle.plate}</p>
                {vehicle.vehicle_type && <p className="mt-2 text-sm text-muted-foreground">{vehicle.vehicle_type}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-success" /> Veículo vinculado ao frete
                </div>
              </div>
            </div>
            {details.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-5 sm:grid-cols-3">
                {details.map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-[10px] font-bold uppercase text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function EmptyAssignment({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed bg-secondary/50 p-4 text-muted-foreground">
      {icon}<span className="text-sm font-medium">{text}</span>
    </div>
  );
}