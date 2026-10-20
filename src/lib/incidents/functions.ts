import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { categorySchema, createIncidentSchema, prioritySchema } from './model';

export const getIncidentWorkspace = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const access = await db.rpc('can_manage_operation_board', { _user: context.userId });
  if (access.error) throw new Error('Não foi possível conferir seu acesso.');
  const manager = access.data === true;
  const categories = await db.rpc('get_incident_categories');
  if (categories.error) throw new Error('Acesso não autorizado às ocorrências.');
  const incidents = [];
  for (let offset = 0; ; offset += 1000) {
    let q = db.from('incidents').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
    if (!manager) q = q.eq('reported_by', context.userId);
    const r = await q; if (r.error) throw new Error('Não foi possível carregar as ocorrências.');
    incidents.push(...(r.data ?? [])); if ((r.data?.length ?? 0) < 1000) break;
  }
  let orderQuery = db.from('orders').select('id,code,status,driver_id,vehicle_id,client_name,work_id,origin_city,destination_city,delivery_window_end,eta_minutes,last_ping_at').is('deleted_at', null).order('created_at', { ascending: false });
  if (!manager) orderQuery = orderQuery.eq('driver_id', context.userId);
  const orders = [];
  for (let offset = 0; ; offset += 1000) { const r = await orderQuery.range(offset, offset + 999); if (r.error) throw new Error('Não foi possível carregar os fretes.'); orders.push(...(r.data ?? [])); if ((r.data?.length ?? 0) < 1000) break; }
  const roleRows = manager ? await db.from('user_roles').select('user_id,role').in('role', ['admin', 'logistics', 'supervisor', 'operacional']) : { data: [], error: null };
  if (roleRows.error) throw new Error('Não foi possível carregar os responsáveis.');
  const profileIds = [...new Set([...incidents.flatMap(i => [i.reported_by, i.assigned_to]), ...orders.map(o => o.driver_id), ...(roleRows.data ?? []).map(r => r.user_id)].filter((id): id is string => Boolean(id)))];
  const workIds = [...new Set(orders.map(o => o.work_id).filter((id): id is string => Boolean(id)))];
  const vehicleIds = [...new Set([...orders.map(o => o.vehicle_id), ...incidents.map(i => i.vehicle_id)].filter((id): id is string => Boolean(id)))];
  const profiles = [], works = [], vehicles = [];
  for (let k = 0; k < profileIds.length; k += 100) { const r = await db.from('profiles').select('id,full_name').in('id', profileIds.slice(k, k + 100)); if (r.error) throw r.error; profiles.push(...(r.data ?? [])); }
  for (let k = 0; k < workIds.length; k += 100) { const r = await db.from('works').select('id,name').in('id', workIds.slice(k, k + 100)); if (r.error) throw r.error; works.push(...(r.data ?? [])); }
  for (let k = 0; k < vehicleIds.length; k += 100) { const r = await db.from('vehicles').select('id,plate').in('id', vehicleIds.slice(k, k + 100)); if (r.error) throw r.error; vehicles.push(...(r.data ?? [])); }
  return { userId: context.userId, manager, isAdmin: (roleRows.data ?? []).some(r => r.user_id === context.userId && r.role === 'admin'), categories: z.array(categorySchema).parse(categories.data), incidents, orders, profiles, works, vehicles, staff: profiles.filter(p => (roleRows.data ?? []).some(r => r.user_id === p.id)) };
});
export const getIncidentDetail = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  const db = context.supabase;
  const allowed = await db.rpc('can_access_incident', { _incident: data.id, _user: context.userId });
  if (allowed.error || !allowed.data) throw new Error('Ocorrência indisponível para sua conta.');
  const [incident, updates, files] = await Promise.all([db.from('incidents').select('*').eq('id', data.id).single(), db.from('incident_updates').select('*').eq('incident_id', data.id).order('created_at').limit(1000), db.from('incident_files').select('*').eq('incident_id', data.id).order('created_at')]);
  if (incident.error || updates.error || files.error) throw new Error('Não foi possível carregar o histórico.');
  const signedFiles = await Promise.all((files.data ?? []).map(async f => { const signed = await db.storage.from('incident-files').createSignedUrl(f.file_path, 300); if (signed.error) throw new Error('Não foi possível abrir o anexo protegido.'); return { ...f, url: signed.data.signedUrl }; }));
  return { incident: incident.data, updates: updates.data ?? [], files: signedFiles };
});
export const createIncident = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(createIncidentSchema).handler(async ({ data, context }) => {
  const r = await context.supabase.rpc('create_driver_incident', { _data: data });
  if (r.error) throw new Error('Não foi possível enviar. Confira o frete ativo, a descrição e a previsão. Seu rascunho foi preservado.');
  return { id: r.data };
});
export const updateIncident = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid(), action: z.enum(['message', 'guidance', 'request_info', 'acknowledge', 'status', 'priority', 'assign', 'resolve', 'close']), message: z.string().trim().max(4000).optional(), status: z.enum(['received', 'analysis', 'awaiting_driver', 'handling']).optional(), priority: prioritySchema.optional(), assignedTo: z.string().uuid().nullable().optional(), internal: z.boolean().default(false) })).handler(async ({ data, context }) => {
  const r = await context.supabase.rpc('manage_driver_incident', { _id: data.id, _action: data.action, _message: data.message, _status: data.status, _priority: data.priority, _assigned_to: data.assignedTo ?? undefined, _internal: data.internal });
  if (r.error) throw new Error('Não foi possível atualizar. Verifique o texto e o estado da ocorrência.');
  return { ok: true };
});
export const saveCategories = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.array(categorySchema).min(1).max(40)).handler(async ({ data, context }) => { const r = await context.supabase.rpc('save_incident_categories', { _categories: data }); if (r.error) throw new Error('Não foi possível salvar as categorias. Mantenha Outros com descrição obrigatória.'); return { ok: true }; });
export type IncidentWorkspaceData = Awaited<ReturnType<typeof getIncidentWorkspace>>;