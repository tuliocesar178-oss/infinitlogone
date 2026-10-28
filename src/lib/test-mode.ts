import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

export const testModeStateSchema = z.object({ enabled: z.boolean(), updated_at: z.string().nullable() });
export const testModeQuery = queryOptions({
  queryKey: ['temporary-test-mode'],
  queryFn: async () => {
    const result = await supabase.rpc('get_test_mode');
    if (result.error) throw new Error('Não foi possível conferir o modo de testes.');
    return testModeStateSchema.parse(result.data);
  },
  staleTime: 0, refetchInterval: 10_000, retry: false,
});
export function useTestMode() {
  const query = useQuery(testModeQuery);
  return { enabled: !query.isError && query.data?.enabled === true, pending: query.isPending, error: query.error };
}
export async function readTestMode() {
  const result = await supabase.rpc('get_test_mode');
  if (result.error) throw new Error('Não foi possível conferir o modo de testes.');
  return testModeStateSchema.parse(result.data).enabled;
}

/** Completeness alone is optional in tests; supplied invalid data is never waived. */
export function evidenceError(mode: boolean, stage: 'pickup' | 'delivery', values: { cargoPhotos?: number; invoice?: boolean; receiver?: string; deliveryPhotos?: number; signedInvoice?: boolean }): string | null {
  if (mode) return null;
  if (stage === 'pickup' && (!values.cargoPhotos || !values.invoice)) return 'Envie fotos da carga e da nota fiscal.';
  if (stage === 'delivery' && (!values.receiver?.trim() || (!values.deliveryPhotos && !values.signedInvoice))) return 'Informe o recebedor e anexe fotos ou canhoto.';
  return null;
}