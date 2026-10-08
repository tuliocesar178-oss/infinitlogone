import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
export const homeDesignSchema = z.enum(['current', 'premium-map']);
export type HomeDesign = z.infer<typeof homeDesignSchema>;
const settingsSchema = z.object({ design: homeDesignSchema, previous: homeDesignSchema });
export const homeDesignQuery = { queryKey: ['public-home-design'], queryFn: async () => {
  const { data, error } = await supabase.rpc('get_public_home_design');
  if (error) throw error;
  return settingsSchema.parse(data);
}, staleTime: 30_000 };
export async function saveHomeDesign(design: HomeDesign) {
  const { data, error } = await supabase.rpc('save_public_home_design', { _design: design });
  if (error) throw error;
  return settingsSchema.parse(data);
}
