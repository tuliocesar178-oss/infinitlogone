import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronDown, ChevronUp, FileCheck2, Navigation, Phone, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PickupEvidenceForm, DeliveryEvidenceForm } from '@/components/driver/panels';
import { nextDriverAction, type DriverAction } from '@/lib/order-flow';
import { STATUS_LABEL } from '@/lib/order-status';
import { performDriverAction, stageFor } from '@/lib/driver-action';
import type { NavigationOrder, Position } from '@/lib/navigation/model';

export interface StageActionProps { order: NavigationOrder; userId: string | null; remaining: number | null; position: Position | null; }

/** Main stage button inside navigation. GPS proximity only reveals hints; every change needs an explicit tap. */
export function StageAction({ order, userId, remaining, position }: StageActionProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<'pickup' | 'delivery' | null>(null);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const action = nextDriverAction(order.status as never);
  const stage = stageFor(action, remaining);
  const refresh = () => qc.invalidateQueries({ queryKey: ['driver-nav-order', order.id] });

  async function run(next: DriverAction, message: string) {
    if (!userId) { toast.error('Sessão expirada. Entre novamente.'); return; }
    setBusy(true);
    try { await performDriverAction(order, next, userId, position); toast.success(message); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar o frete.'); }
    finally { setBusy(false); }
  }
  // Reaching loading/unloading requires explicit confirmation, then the existing evidence forms.
  async function openEvidence(kind: 'pickup' | 'delivery', transition: DriverAction | null) {
    if (transition) await run(transition, kind === 'pickup' ? 'Chegada à coleta confirmada.' : 'Chegada ao destino confirmada.');
    setOpen(kind);
  }

  const contact = order.status && ['driver_assigned','en_route_pickup','in_transit_to_pickup','near_pickup','arriving_pickup','at_pickup','loading'].includes(order.status) ? order.pickup_contact_name : order.delivery_contact_name;
  const big = 'h-14 w-full text-base font-black uppercase tracking-wide';
  return <div className="space-y-2">
    {stage === 'near_pickup' && <p role="status" className="text-sm font-medium text-brand">Você está chegando à coleta.</p>}
    {stage === 'near_delivery' && <p role="status" className="text-sm font-medium text-brand">Você está chegando ao destino.</p>}
    {stage === 'start_pickup' && <Button className={big} disabled={busy} onClick={() => run('start_pickup', 'Deslocamento até a coleta iniciado.')}><Navigation />Iniciar deslocamento à coleta</Button>}
    {(stage === 'near_pickup' || stage === 'go_pickup') && <Button className={big} variant={stage === 'near_pickup' ? 'default' : 'outline'} disabled={busy} onClick={() => openEvidence('pickup', 'start_loading')}><Camera />Cheguei à coleta — tirar fotos</Button>}
    {stage === 'pickup_checklist' && <Button className={big} disabled={busy} onClick={() => setOpen('pickup')}><Camera />Checklist e fotos da coleta</Button>}
    {stage === 'start_trip' && <Button className={big} disabled={busy} onClick={() => run('start_delivery', 'Viagem até a entrega iniciada.')}><Truck />Iniciar viagem até a entrega</Button>}
    {(stage === 'near_delivery' || stage === 'go_delivery') && <Button className={big} variant={stage === 'near_delivery' ? 'default' : 'outline'} disabled={busy} onClick={() => openEvidence('delivery', 'start_unloading')}><FileCheck2 />Preparar entrega</Button>}
    {stage === 'delivery_docs' && <Button className={big} disabled={busy} onClick={() => setOpen('delivery')}><FileCheck2 />Enviar comprovantes e finalizar entrega</Button>}
    {(stage === 'go_pickup' || stage === 'go_delivery') && <p className="text-center text-xs text-muted-foreground">A proximidade pelo GPS só sugere a chegada; confirme com o botão quando estiver no local.</p>}
    <button type="button" className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground" onClick={() => setDetails(v => !v)} aria-expanded={details}>
      <span>{order.code ?? 'Frete'} · {STATUS_LABEL[order.status] ?? order.status}</span>{details ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
    </button>
    {details && <dl className="grid gap-1 text-sm">
      <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd>{order.client_name ?? '—'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Responsável no local</dt><dd>{contact ?? order.contact_name ?? '—'}</dd></div>
      {order.contact_phone && <a className="inline-flex items-center gap-2 text-brand" href={`tel:${order.contact_phone}`}><Phone className="h-4 w-4" />Ligar para o contato</a>}
    </dl>}
    <Sheet open={open !== null} onOpenChange={value => { if (!value) setOpen(null); }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0">
        <SheetHeader className="p-4"><SheetTitle>{open === 'pickup' ? 'Coleta: fotos e confirmação' : 'Entrega: comprovantes'}</SheetTitle></SheetHeader>
        {open === 'pickup' && userId && <PickupEvidenceForm orderId={order.id} userId={userId} position={position} onCancel={() => setOpen(null)} onDone={() => { setOpen(null); void run('loaded', 'Coleta confirmada. Toque em iniciar viagem.'); }} />}
        {open === 'delivery' && userId && <DeliveryEvidenceForm orderId={order.id} userId={userId} position={position} onCancel={() => setOpen(null)} onDone={() => { setOpen(null); void run('delivered', 'Entrega finalizada.'); }} />}
      </SheetContent>
    </Sheet>
  </div>;
}
