import { NAV_PROVIDERS, openNavigation, type NavTarget } from "@/lib/nav-launcher";
import { Navigation, X } from "lucide-react";

export function NavLauncherModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: NavTarget | null;
  onClose: () => void;
}) {
  if (!open || !target) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-brand">
              <Navigation className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Iniciar navegação</div>
              <div className="text-xs text-muted-foreground">Escolha seu app preferido</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2">
          {NAV_PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                openNavigation(p.key, target);
                onClose();
              }}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-left transition hover:border-brand hover:bg-surface-2"
            >
              <div>
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.hint}</div>
              </div>
              <Navigation className="h-4 w-4 text-brand" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
