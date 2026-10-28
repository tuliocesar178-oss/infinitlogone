import { FlaskConical } from 'lucide-react';
import { useTestMode } from '@/lib/test-mode';

export function TestModeNotice() {
  const mode = useTestMode();
  if (!mode.enabled) return null;
  return <p role="status" className="mb-4 flex items-center gap-2 border-l-2 border-warning pl-3 text-sm text-warning"><FlaskConical className="h-4 w-4 shrink-0" />Modo de testes · informações e documentos pendentes</p>;
}
export function CompletenessNotice({ pending }: { pending: readonly string[] | null | undefined }) {
  if (!pending?.length) return null;
  return <p className="my-3 break-words text-sm text-warning">{pending.join(' · ')}</p>;
}