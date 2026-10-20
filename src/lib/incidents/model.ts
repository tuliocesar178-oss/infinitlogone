import { z } from 'zod';

export const PRIORITIES = { informative: 'Informativa', attention: 'Atenção', high: 'Alta', critical: 'Crítica' } as const;
export const STATUSES = { open: 'Aberta', received: 'Recebida pela operação', analysis: 'Em análise', awaiting_driver: 'Aguardando resposta do motorista', handling: 'Em tratativa', resolved: 'Resolvida', closed: 'Encerrada' } as const;
export const STAGES: Record<string, string> = { pickup_travel: 'Deslocamento para coleta', loading: 'Carregamento', transit: 'Em trânsito', unloading: 'Descarga', completion: 'Finalização' };
export const ACTIONS: Record<string, string> = { created: 'Enviada', acknowledge: 'Recebimento confirmado', message: 'Resposta', guidance: 'Orientação', request_info: 'Informações solicitadas', status: 'Estado atualizado', priority: 'Prioridade atualizada', assign: 'Responsável atualizado', resolve: 'Resolvida', close: 'Encerrada' };
export const prioritySchema = z.enum(['informative', 'attention', 'high', 'critical']);
export const categorySchema = z.object({ value: z.string().regex(/^[a-z][a-z_]{1,49}$/), label: z.string().trim().min(1).max(120), priority: prioritySchema, requires_description: z.boolean() });
export type IncidentCategory = z.infer<typeof categorySchema>;
export const createIncidentSchema = z.object({
  request_id: z.string().uuid(), order_id: z.string().uuid(), type: z.string().min(1), description: z.string().trim().max(4000),
  safe_stop: z.literal(true), affects_deadline: z.boolean(), driver_eta: z.string().datetime().nullable(),
  latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), location_captured_at: z.string().datetime().nullable(),
}).superRefine((value, ctx) => {
  if ((value.latitude === null) !== (value.longitude === null) || (value.latitude !== null && !value.location_captured_at)) ctx.addIssue({ code: 'custom', message: 'Localização incompleta.' });
});
export type CreateIncident = z.infer<typeof createIncidentSchema>;
export function validateIncidentExplanation(category: IncidentCategory, description: string): boolean { return !category.requires_description || description.trim().length >= 3; }
export function priorityRank(priority: string): number { return ['informative', 'attention', 'high', 'critical'].indexOf(priority); }
export function incidentStage(status: string): string {
  if (['at_pickup', 'loading', 'loaded'].includes(status)) return 'loading';
  if (['picked_up', 'out_for_delivery', 'in_transit', 'near_destination', 'arriving_destination'].includes(status)) return 'transit';
  if (['at_destination', 'unloading'].includes(status)) return 'unloading';
  if (['delivered', 'finalized'].includes(status)) return 'completion';
  return 'pickup_travel';
}