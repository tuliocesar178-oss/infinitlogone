import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDriverAvailability } from '@/hooks/use-driver-availability';
import { Button } from '@/components/ui/button';
import { Power } from 'lucide-react';

export interface OnlineControlProps { userId: string }

export function OnlineControl({ userId }: OnlineControlProps) {
  const q = useQuery({
    queryKey: ['driver-profile-page', userId, 'availability'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const result = await supabase.from('drivers').select('availability, status').eq('user_id', userId).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error('Cadastro de motorista não encontrado.');
      return result.data;
    },
    refetchInterval: 15000,
  });
  const mutation = useDriverAvailability(userId);
  const online = q.data?.availability === 'disponivel' || q.data?.availability === 'em_frete';
  return <section className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
    <p className="text-sm font-medium">{q.isError ? q.error.message : q.isPending ? 'Conferindo disponibilidade…' : online ? 'Você está online' : 'Você está offline'}</p>
    <Button disabled={!q.data || mutation.isPending} variant={online ? 'outline' : 'default'} onClick={() => mutation.mutate(online ? 'offline' : 'disponivel')}>
      <Power /> {mutation.isPending ? 'Atualizando…' : online ? 'Ficar offline' : 'Ficar online'}
    </Button>
  </section>;
}