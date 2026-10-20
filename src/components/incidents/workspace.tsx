import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { getIncidentWorkspace } from '@/lib/incidents/functions';
import { LEGACY_INCIDENT_LABELS, PRIORITIES, STATUSES, priorityRank } from '@/lib/incidents/model';
import { IncidentReportForm } from './report-form';
import { IncidentDetail } from './detail';
import { IncidentCategories } from './categories';
import { cn } from '@/lib/utils';

export interface IncidentWorkspaceProps { driver?: boolean; orderId?: string; reportOnly?: boolean; onClose?: () => void; }
export function IncidentWorkspace({ driver = false, orderId, reportOnly = false, onClose }: IncidentWorkspaceProps) {
  const read = useServerFn(getIncidentWorkspace), qc = useQueryClient();
  const q = useQuery({ queryKey: ['incident-workspace', driver], queryFn: () => read(), refetchInterval: 15000 });
  const [report, setReport] = useState(reportOnly), [detail, setDetail] = useState<string | null>(null), [categories, setCategories] = useState(false);
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [priority, setPriority] = useState(''), [status, setStatus] = useState('');
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ['incident-workspace'] }); void qc.invalidateQueries({ queryKey: ['incident-detail'] }); };
    const channel = supabase.channel(`incidents-workspace-${driver ? 'driver' : 'ops'}`).on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'incident_updates' }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'incident_files' }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [driver, qc]);
  if (q.isPending) return <p role="status" className="p-4 text-muted-foreground">Carregando ocorrências…</p>;
  if (q.error) return <div className="space-y-3 p-4"><p role="alert" className="text-destructive">{q.error.message}</p><Button variant="outline" onClick={() => void q.refetch()}>Tentar novamente</Button></div>;
  if (!q.data) return null;
  const w = q.data;
  const displayedCategories = [...w.categories, ...Object.entries(LEGACY_INCIDENT_LABELS).filter(([value]) => !w.categories.some(c => c.value === value)).map(([value, label]) => ({ value, label }))];
  const visible = w.incidents.filter(i => {
    const order = w.orders.find(o => o.id === i.order_id);
    const haystack = [order?.code, order?.client_name, w.works.find(work => work.id === order?.work_id)?.name, w.profiles.find(p => p.id === i.reported_by)?.full_name, displayedCategories.find(c => c.value === i.type)?.label, i.description].join(' ').toLocaleLowerCase('pt-BR');
    return (!orderId || i.order_id === orderId) && (!search || haystack.includes(search.toLocaleLowerCase('pt-BR'))) && (!category || i.type === category) && (!priority || i.priority === priority) && (!status || i.workflow_status === status) && (!from || Date.parse(i.created_at) >= new Date(`${from}T00:00:00`).getTime()) && (!to || Date.parse(i.created_at) < new Date(`${to}T23:59:59.999`).getTime());
  }).sort((a, b) => Number(Boolean(a.resolved_at)) - Number(Boolean(b.resolved_at)) || priorityRank(b.priority) - priorityRank(a.priority) || Date.parse(a.created_at) - Date.parse(b.created_at));
  if (reportOnly) return <IncidentReportForm workspace={w} orderId={orderId} onSent={() => onClose?.()} />;
  return <section className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{driver ? 'Ocorrências da viagem' : 'Central de Ocorrências'}</h1><div className="flex gap-2">{driver && <Button onClick={() => setReport(true)}><Plus />Registrar ocorrência</Button>}{w.isAdmin && <Button variant="outline" onClick={() => setCategories(true)}><Settings />Categorias</Button>}</div></header>
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label="Buscar motorista, cliente, obra ou frete" placeholder="Motorista, cliente, obra ou frete" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filtrar categoria" className="h-10 min-w-0 w-full rounded-md border bg-background px-2" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{displayedCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select><select aria-label="Filtrar prioridade" className="h-10 min-w-0 w-full rounded-md border bg-background px-2" value={priority} onChange={e => setPriority(e.target.value)}><option value="">Todas as prioridades</option>{Object.entries(PRIORITIES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><select aria-label="Filtrar estado" className="h-10 min-w-0 w-full rounded-md border bg-background px-2" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos os estados</option>{Object.entries(STATUSES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><label className="text-xs text-muted-foreground">De<Input aria-label="Data inicial" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs text-muted-foreground">Até<Input aria-label="Data final" type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
    <div className="grid gap-3 lg:grid-cols-2">{visible.map(i => { const order = w.orders.find(o => o.id === i.order_id); return <article key={i.id} className={cn('rounded-md border bg-card p-4', ['high', 'critical'].includes(i.priority) && !i.resolved_at ? 'border-destructive' : 'border-border')}><div className="flex items-start justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 shrink-0 text-warning" />{displayedCategories.find(c => c.value === i.type)?.label ?? i.type}</h2><span className="text-xs text-muted-foreground">{PRIORITIES[i.priority as keyof typeof PRIORITIES]}</span></div><p className="mt-2 text-sm">{order?.code ?? 'Frete'} · {order?.client_name ?? 'Cliente não informado'}</p><p className="text-xs text-muted-foreground">{w.profiles.find(p => p.id === i.reported_by)?.full_name ?? 'Motorista não informado'} · {w.vehicles.find(v => v.id === i.vehicle_id)?.plate ?? 'Veículo não informado'} · {w.works.find(work => work.id === order?.work_id)?.name ?? 'Obra não informada'}</p><p className="mt-2 text-sm">{STATUSES[i.workflow_status as keyof typeof STATUSES]}{i.affects_deadline && ' · Impacto no prazo informado'}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString('pt-BR')}</p><Button className="mt-3" variant="outline" onClick={() => setDetail(i.id)}>Abrir ocorrência</Button></article>; })}</div>
    {!visible.length && <p className="py-12 text-center text-muted-foreground">Nenhuma ocorrência nesta seleção.</p>}
    <Dialog open={report} onOpenChange={setReport}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Registrar ocorrência</DialogTitle><DialogDescription>{orderId ? 'Frete da navegação selecionado' : 'Ocorrência da viagem'}</DialogDescription><IncidentReportForm workspace={w} orderId={orderId} onSent={() => setReport(false)} /></DialogContent></Dialog>
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogTitle>Detalhes da ocorrência</DialogTitle><DialogDescription>Frete, anexos e histórico</DialogDescription>{detail && <IncidentDetail key={detail} id={detail} workspace={w} />}</DialogContent></Dialog>
    <Dialog open={categories} onOpenChange={setCategories}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogTitle>Categorias de ocorrência</DialogTitle><DialogDescription>Classificação padrão da operação</DialogDescription><IncidentCategories categories={w.categories} /></DialogContent></Dialog>
  </section>;
}