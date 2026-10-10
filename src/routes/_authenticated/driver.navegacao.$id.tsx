import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NavigationView } from '@/components/navigation/navigation-view';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/driver/navegacao/$id')({
  head: () => ({ meta: [{ title: 'Navegação GPS do frete — INFINITLOG' }, { name: 'description', content: 'Navegação Mapbox para coleta e entrega, posição atual, instruções e escolha opcional de aplicativo.' }, { property: 'og:title', content: 'Navegação GPS — INFINITLOG' }, { property: 'og:description', content: 'Acompanhe sua rota de coleta e entrega dentro da INFINITLOG.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: DriverNavigationPage,
  errorComponent: ({ error }) => <div role="alert" className="p-6">Não foi possível abrir a navegação: {error instanceof Error ? error.message : 'Tente novamente.'}<Button asChild variant="link"><Link to="/driver">Voltar ao frete</Link></Button></div>,
});
function DriverNavigationPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ['driver-nav-order', id], queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error('Sessão expirada.');
    const { data, error } = await supabase.from('orders').select('id,status,driver_id,origin_lat,origin_lng,origin_address,destination_lat,destination_lng,destination_address').eq('id', id).eq('driver_id', auth.user.id).maybeSingle();
    if (error) throw error;
    return data;
  }, refetchInterval: 5000 });
  if (query.isPending) return <div className="p-6" role="status">Carregando frete…</div>;
  if (query.error) return <div role="alert" className="p-6">{query.error.message}<Button onClick={() => query.refetch()}>Tentar novamente</Button></div>;
  if (!query.data) return <div className="p-6">Frete não encontrado ou não autorizado.</div>;
  return <NavigationView key={id} order={query.data} />;
}
