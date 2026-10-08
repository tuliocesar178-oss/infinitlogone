import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, RotateCcw, Save, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { homeDesignQuery, saveHomeDesign, type HomeDesign } from '@/lib/home-design';
import highway from '@/assets/logistics-highway.jpg';
import { cn } from '@/lib/utils';
export type { HomeDesign } from '@/lib/home-design';
const designs = [{ id: 'current', name: 'Design atual' }, { id: 'premium-map', name: 'Mapa Logístico Premium' }] as const;
export function HomeDesignSettings() {
  const query = useQuery(homeDesignQuery);
  const qc = useQueryClient();
  const [choice, setChoice] = useState<HomeDesign | null>(null);
  const [previewed, setPreviewed] = useState<HomeDesign | null>(null);
  const [message, setMessage] = useState('');
  const selected = choice ?? query.data?.design ?? 'current';
  const save = useMutation({ mutationFn: saveHomeDesign, onSuccess: data => {
    qc.setQueryData(homeDesignQuery.queryKey, data); setChoice(null); setMessage('Design da página inicial salvo para todos os visitantes.');
  }});
  function preview(id: HomeDesign) { setPreviewed(id); window.open(`/?design=${id}`, '_blank', 'noopener,noreferrer'); }
  return <section className="space-y-6" aria-label="Personalização do Site">
    <header><h2 className="text-xl font-semibold">Personalização do Site</h2><h3 className="mt-2 text-sm text-muted-foreground">Design da Página Inicial</h3></header>
    {query.isLoading ? <p>Carregando opções...</p> : <div className="grid gap-5 md:grid-cols-2">{designs.map(design => <article key={design.id} className={cn('overflow-hidden rounded-xl border bg-card', selected === design.id && 'border-brand ring-2 ring-brand/20')}>
      <div className="relative h-40 overflow-hidden bg-surface-2" aria-hidden="true">
        {design.id === 'premium-map' && <img src={highway} alt="" width={1536} height={864} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-y-0 left-0 w-1/2 bg-background/90 p-5"><div className="h-2 w-12 rounded bg-brand"/><p className="mt-3 text-lg font-bold text-primary">{design.id === 'premium-map' ? 'Sua carga em boas mãos.' : 'Sua carga em movimento.'}</p><div className="mt-4 h-4 rounded-full bg-brand/20"/></div>
        {design.id === 'premium-map' && <MapPin className="absolute right-8 top-5 h-8 w-8 text-brand"/>}
        {query.data?.design === design.id && <span className="absolute bottom-2 right-2 rounded bg-background px-2 py-1 text-xs">Design ativo</span>}
      </div>
      <div className="space-y-4 p-5"><h4 className="font-semibold">{design.name}</h4><div className="flex gap-2">
        <Button variant="outline" onClick={() => preview(design.id)}><Eye className="mr-2 h-4 w-4"/>Pré-visualizar</Button>
        <Button disabled={save.isPending} onClick={() => { if (design.id !== query.data?.design && previewed !== design.id) { preview(design.id); setMessage('Confira a pré-visualização e clique novamente em Aplicar design.'); return; } setChoice(design.id); setMessage('Seleção pronta. Salve para aplicar à página pública.'); }}><Check className="mr-2 h-4 w-4"/>Aplicar design</Button>
      </div></div>
    </article>)}</div>}
    <div className="flex flex-wrap gap-3"><Button disabled={save.isPending || query.isLoading || selected === query.data?.design} onClick={() => save.mutate(selected)}><Save className="mr-2 h-4 w-4"/>Salvar alterações</Button>
      <Button variant="outline" disabled={!query.data || save.isPending || query.data.previous === query.data.design} onClick={() => { if (query.data) { setChoice(query.data.previous); preview(query.data.previous); setMessage('Design anterior selecionado. Salve para confirmar a restauração.'); } }}><RotateCcw className="mr-2 h-4 w-4"/>Restaurar design anterior</Button></div>
    {(query.error || save.error) && <p role="alert" className="text-sm text-destructive">Não foi possível salvar ou carregar a configuração. Tente novamente.</p>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </section>;
}
