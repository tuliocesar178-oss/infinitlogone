import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { testModeQuery, testModeStateSchema } from '@/lib/test-mode';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { registrationPermissions } from '@/lib/registration.functions';

export function TestModeControl() {
  const cache = useQueryClient();
  const mode = useQuery(testModeQuery);
  const permission = useQuery({ queryKey: ['test-mode-admin'], queryFn: () => registrationPermissions(), retry: false });
  const save = useMutation({
    mutationFn: async (enabled: boolean) => {
      const result = await supabase.rpc('set_test_mode', { _enabled: enabled });
      if (result.error) throw new Error('Somente o administrador pode alterar o modo de testes.');
      return testModeStateSchema.parse(result.data);
    },
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['temporary-test-mode'] }); },
  });
  return <section className="mb-8 space-y-3 border-y border-border py-5">
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 font-semibold"><FlaskConical className="h-5 w-5 text-warning" />Modo de testes temporário</h2>
      <Switch aria-label="Modo de testes temporário" checked={mode.data?.enabled === true} disabled={!permission.data?.isAdmin || mode.isPending || mode.isError || save.isPending} onCheckedChange={enabled => {
        if (!enabled && !window.confirm('Restaurar exigências de produção? Os registros e históricos serão preservados.')) return;
        save.mutate(enabled);
      }} />
    </div>
    <p className="text-sm text-muted-foreground">{mode.isPending ? 'Consultando…' : mode.data?.enabled ? 'Ativo · informações e documentos podem ficar pendentes.' : 'Desativado · exigências de produção.'}</p>
    {mode.data?.updated_at && <p className="text-xs text-muted-foreground">Alterado em {new Date(mode.data.updated_at).toLocaleString('pt-BR')}</p>}
    {(mode.error || permission.error || save.error) && <p role="alert" className="text-sm text-destructive">{save.error?.message ?? mode.error?.message ?? permission.error?.message}</p>}
    {mode.isError && <Button variant="outline" onClick={() => void mode.refetch()}>Tentar novamente</Button>}
  </section>;
}