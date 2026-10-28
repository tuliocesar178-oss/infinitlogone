import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, Paperclip, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { createIncident, type IncidentWorkspaceData } from '@/lib/incidents/functions';
import { useTestMode } from '@/lib/test-mode';
import { incidentStage, STAGES, validateIncidentExplanation } from '@/lib/incidents/model';
import { compressIncidentImage, readDrafts, removeDraft, storeDraft, type IncidentDraft } from '@/lib/incidents/drafts';

export interface IncidentReportFormProps { workspace: IncidentWorkspaceData; orderId?: string; onSent: () => void; }
export function IncidentReportForm({ workspace: w, orderId: preferred, onSent }: IncidentReportFormProps) {
  const mode=useTestMode();
  const orders = w.orders.filter(o => !['delivered', 'finalized', 'cancelled'].includes(o.status));
  const [orderId, setOrderId] = useState(preferred ?? orders[0]?.id ?? '');
  const [type, setType] = useState(w.categories[0]?.value ?? 'other');
  const [description, setDescription] = useState(''), [eta, setEta] = useState('');
  const [safe, setSafe] = useState(false), [affects, setAffects] = useState(false), [gps, setGps] = useState(false);
  const [files, setFiles] = useState<IncidentDraft['files']>([]), [drafts, setDrafts] = useState<IncidentDraft[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [frozen, setFrozen] = useState(false);
  const lock = useRef(false), requestId = useRef<string | null>(null);
  const send = useServerFn(createIncident), qc = useQueryClient();
  const order = orders.find(o => o.id === orderId), category = w.categories.find(c => c.value === type);
  const refreshDrafts = () => readDrafts(w.userId).then(setDrafts).catch(() => setError('Rascunhos indisponíveis neste aparelho.'));
  useEffect(() => { void refreshDrafts(); }, [w.userId]);
  async function addFiles(selected: FileList | null) {
    if (!selected) return;
    try { const next = await Promise.all(Array.from(selected).map(async f => ({ id: crypto.randomUUID(), file: await compressIncidentImage(f) }))); if (next.some(f => f.file.size > 20 * 1024 * 1024) || files.length + next.length > 10) throw new Error('Selecione até 10 arquivos, com no máximo 20 MB cada.'); setFiles(previous => [...previous, ...next]); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível preparar os anexos.'); }
  }
  async function transmit(draft: IncidentDraft) {
    const result = await send({ data: draft.payload });
    draft.incidentId = result.id;
    await storeDraft(draft);
    for (const attachment of draft.files) {
      const path = `${result.id}/${attachment.id}-${attachment.file.name.replace(/[^\w.\-]/g, '_')}`;
      const upload = await supabase.storage.from('incident-files').upload(path, attachment.file, { upsert: false, contentType: attachment.file.type || 'application/octet-stream' });
      if (upload.error && upload.error.statusCode !== '409' && !upload.error.message.toLowerCase().includes('already exists')) throw new Error('Ocorrência enviada; há anexos pendentes. Tente enviar o rascunho novamente.');
      const link = await supabase.rpc('link_incident_file', { _incident: result.id, _path: path, _label: attachment.file.name.slice(0, 200), _mime: attachment.file.type || 'application/octet-stream', _size: attachment.file.size });
      if (link.error) throw new Error('Ocorrência enviada; não foi possível confirmar um anexo. O rascunho foi preservado.');
    }
    await removeDraft(draft.id); await refreshDrafts();
    await qc.invalidateQueries({ queryKey: ['incident-workspace'] }); await qc.invalidateQueries({ queryKey: ['operation-board'] });
    toast.success('Ocorrência recebida pela operação.'); onSent();
  }
  async function submit(saveOnly = false, existing?: IncidentDraft) {
    if (lock.current) return;
    if (!existing && (!order || !category || !validateIncidentExplanation(category, description, mode.enabled))) { setError('Confira o frete e descreva o que aconteceu.'); return; }
    if (!safe) { setError('Confirme que o veículo está parado em segurança.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      let draft = existing;
      if (!draft) {
        requestId.current ??= crypto.randomUUID();
        let location: { latitude: number; longitude: number; location_captured_at: string } | null = null;
        if (gps && navigator.onLine && navigator.geolocation) location = await new Promise(resolve => navigator.geolocation.getCurrentPosition(p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, location_captured_at: new Date(p.timestamp).toISOString() }), () => resolve(null), { timeout: 5000, maximumAge: 0, enableHighAccuracy: true }));
        draft = { id: requestId.current, userId: w.userId, savedAt: new Date().toISOString(), files, payload: { request_id: requestId.current, order_id: orderId, type, description, safe_stop: true, affects_deadline: affects, driver_eta: eta ? new Date(eta).toISOString() : null, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null, location_captured_at: location?.location_captured_at ?? null } };
      }
      await storeDraft(draft); setFrozen(true); await refreshDrafts();
      if (saveOnly || !navigator.onLine) { toast.info('Rascunho salvo no aparelho — não enviado.'); return; }
      await transmit(draft); requestId.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha no envio. Seu rascunho foi preservado.'); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-4">
    {drafts.length > 0 && <section className="space-y-2 border-b pb-3"><h3 className="font-semibold text-warning">Rascunhos neste aparelho</h3>{drafts.map(d => <div key={d.id} className="flex items-center gap-2"><p className="min-w-0 flex-1 text-sm">{d.incidentId ? 'Anexos pendentes' : 'Não enviado'} · {w.orders.find(o => o.id === d.payload.order_id)?.code ?? 'Frete'} · {d.files.length} anexo(s)</p><Button size="sm" disabled={busy || !safe} onClick={() => void submit(false, d)}><Send />Enviar</Button><Button size="icon" variant="ghost" disabled={busy} aria-label="Excluir rascunho" onClick={() => void removeDraft(d.id).then(refreshDrafts)}><Trash2 /></Button></div>)}</section>}
    <label className="flex items-center gap-3 rounded-md border border-warning p-3 text-sm"><input type="checkbox" checked={safe} onChange={e => setSafe(e.target.checked)} /><AlertTriangle className="h-5 w-5 shrink-0 text-warning" />Veículo parado em segurança</label>
    <fieldset disabled={busy || frozen} className="space-y-4">
    <label className="block space-y-1 text-sm font-medium">Frete ativo<select aria-label="Frete ativo" className="h-12 w-full rounded-md border bg-background px-3" value={orderId} onChange={e => setOrderId(e.target.value)}>{!orders.length && <option value="">Nenhum frete ativo atribuído</option>}{orders.map(o => <option key={o.id} value={o.id}>{o.code} · {o.origin_city} → {o.destination_city}</option>)}</select></label>
    {order && <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>Cliente: {order.client_name ?? 'Não informado'}</div><div>Obra: {w.works.find(work => work.id === order.work_id)?.name ?? 'Não informada'}</div><div>Etapa: {STAGES[incidentStage(order.status)]}</div><div>Veículo: {w.vehicles.find(v => v.id === order.vehicle_id)?.plate ?? 'Não informado'}</div></dl>}
    <label className="block space-y-1 text-sm font-medium">O que aconteceu?<select aria-label="Tipo de ocorrência" className="h-12 w-full rounded-md border bg-background px-3" value={type} onChange={e => setType(e.target.value)}>{w.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <label className="block space-y-1 text-sm font-medium">Descrição {category?.requires_description && !mode.enabled ? '(obrigatória)' : '(opcional)'}<Textarea aria-label="Descrição" value={description} maxLength={4000} onChange={e => setDescription(e.target.value)} placeholder="O que a operação precisa saber?" /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={affects} onChange={e => setAffects(e.target.checked)} />Pode afetar o prazo da coleta ou entrega</label>
    <label className="block space-y-1 text-sm font-medium">Minha previsão de resolução (opcional)<Input aria-label="Minha previsão de resolução" type="datetime-local" value={eta} onChange={e => setEta(e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gps} onChange={e => setGps(e.target.checked)} />Autorizar localização neste registro (opcional)</label>
    <div className="grid grid-cols-2 gap-2"><label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm"><Camera className="h-4 w-4" />Câmera<input aria-label="Foto da câmera" type="file" className="sr-only" accept="image/*" capture="environment" onChange={e => void addFiles(e.target.files)} /></label><label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm"><Paperclip className="h-4 w-4" />Galeria / documentos<input aria-label="Fotos e documentos" type="file" className="sr-only" multiple accept="image/*,.pdf,.xml" onChange={e => void addFiles(e.target.files)} /></label></div>
    {files.map(f => <div key={f.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-all">{f.file.name}</span><Button size="icon" variant="ghost" aria-label={`Remover ${f.file.name}`} onClick={() => setFiles(previous => previous.filter(p => p.id !== f.id))}><Trash2 /></Button></div>)}
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="grid gap-2"><Button className="min-h-12" disabled={busy || frozen || !safe || !order} onClick={() => void submit()}><Send />{busy ? 'Enviando…' : 'Enviar para a operação'}</Button><Button variant="outline" disabled={busy || frozen || !safe || !order} onClick={() => void submit(true)}>Guardar rascunho — não enviado</Button>{frozen && <Button variant="outline" disabled={busy} onClick={() => { requestId.current = null; setFrozen(false); setDescription(''); setFiles([]); setEta(''); }}>Nova ocorrência</Button>}</div>
  </div>;
}