import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SheetState = 'expanded' | 'compact' | 'minimized';
const ORDER: SheetState[] = ['minimized', 'compact', 'expanded'];
const LABEL: Record<SheetState, string> = { expanded: 'expandido', compact: 'compacto', minimized: 'minimizado' };

export interface NavigationSheetProps {
  storageKey: string;
  minimized: ReactNode;
  compact: ReactNode;
  expanded: ReactNode;
}

/**
 * Bottom panel with three heights. The handle accepts tap (cycle) and vertical
 * drag; only the handle is draggable so buttons below can never be triggered
 * by a drag gesture.
 */
export function NavigationSheet({ storageKey, minimized, compact, expanded }: NavigationSheetProps) {
  const [state, setState] = useState<SheetState>('expanded');
  const [dragY, setDragY] = useState(0);
  const start = useRef<number | null>(null);
  // Restore the choice for this navigation after hydration (avoids SSR mismatch).
  useEffect(() => { const saved = sessionStorage.getItem(storageKey); if (saved === 'expanded' || saved === 'compact' || saved === 'minimized') setState(saved); }, [storageKey]);
  const choose = (next: SheetState) => { setState(next); sessionStorage.setItem(storageKey, next); };
  const down = (event: PointerEvent<HTMLButtonElement>) => { start.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: PointerEvent<HTMLButtonElement>) => { if (start.current !== null) setDragY(event.clientY - start.current); };
  const up = () => {
    if (start.current === null) return;
    const delta = dragY; start.current = null; setDragY(0);
    const index = ORDER.indexOf(state);
    if (Math.abs(delta) < 8) choose(state === 'expanded' ? 'compact' : state === 'compact' ? 'minimized' : 'expanded');
    else if (delta < -40) choose(ORDER[Math.min(2, index + 1)]);
    else if (delta > 40) choose(ORDER[Math.max(0, index - 1)]);
  };
  return <section
    data-navigation-bottom
    aria-label={`Painel da navegação, ${LABEL[state]}`}
    className={cn('absolute inset-x-2 bottom-0 z-10 mx-auto max-w-2xl rounded-t-2xl border border-b-0 border-border bg-background/95 shadow-lg backdrop-blur', start.current === null && 'transition-transform duration-200 ease-out')}
    style={{ transform: `translateY(${Math.max(0, dragY)}px)`, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
  >
    <button
      type="button"
      className="flex w-full touch-none justify-center pb-2 pt-3"
      aria-label={state === 'expanded' ? 'Recolher painel' : 'Expandir painel'}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDragY(0); }}
      onKeyDown={event => { if (event.key === 'ArrowUp') choose(ORDER[Math.min(2, ORDER.indexOf(state) + 1)]); if (event.key === 'ArrowDown') choose(ORDER[Math.max(0, ORDER.indexOf(state) - 1)]); }}
    >
      <span className="h-1.5 w-12 rounded-full bg-muted-foreground/50" />
    </button>
    <div className={cn('px-3', state === 'expanded' && 'max-h-[min(62vh,560px)] overflow-y-auto')}>
      {state === 'minimized' ? minimized : state === 'compact' ? compact : expanded}
    </div>
  </section>;
}
