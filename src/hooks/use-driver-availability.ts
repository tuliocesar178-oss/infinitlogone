import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { availabilityUpdate, requireAvailabilityRow } from '@/lib/driver-availability';
import type { Availability } from '@/lib/pf';
import { toast } from 'sonner';

export function useDriverAvailability(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (availability: Availability) => {
      if (!userId) throw new Error('Entre novamente para atualizar sua disponibilidade.');
      const result = await supabase.from('drivers').update(availabilityUpdate(availability))
        .eq('user_id', userId).select('user_id, availability, status').maybeSingle();
      if (result.error) throw new Error(result.error.message);
      return requireAvailabilityRow(result.data);
    },
    onSuccess: async () => {
      await Promise.all(['driver-me', 'driver-profile-page', 'driver-offers', 'driver-home-stats'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success('Disponibilidade atualizada');
    },
    onError: (error) => toast.error(error.message),
  });
}