import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
export { missingEvidenceError as evidenceError } from './test-mode-model';

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
