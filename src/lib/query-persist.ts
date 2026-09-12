import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

const CACHE_KEY = "infinitlog-offline-cache";
const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 dias de dados offline

type Snapshot = { savedAt: number; state: unknown };

/**
 * Persiste o cache de consultas no dispositivo para que fretes, rotas e
 * documentos já sincronizados continuem visíveis sem internet.
 * Retorna a função de limpeza (para desmontagem).
 */
export function enableOfflinePersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  // 1) Restaura o snapshot fora do caminho crítico da primeira pintura.
  const restore = () => {
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (raw) {
        const snapshot = JSON.parse(raw) as Snapshot;
        if (Date.now() - snapshot.savedAt <= MAX_AGE) {
          // Não substitui dados que já tenham chegado da rede.
          const hasFreshData = queryClient
            .getQueryCache()
            .getAll()
            .some((query) => query.state.status === "success");
          if (!hasFreshData) hydrate(queryClient, snapshot.state);
        } else {
          window.localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn("[Offline] cache inválido, ignorando", error);
    }
  };

  let idleId: number | undefined;
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;
  if ("requestIdleCallback" in window) {
    idleId = window.requestIdleCallback(restore, { timeout: 1500 });
  } else {
    restoreTimer = globalThis.setTimeout(restore, 0);
  }

  // 2) Grava alterações com throttle para não pesar no dispositivo.
  let timer: number | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      try {
        const snapshot: Snapshot = {
          savedAt: Date.now(),
          state: dehydrate(queryClient, {
            shouldDehydrateQuery: (query) => query.state.status === "success",
          }),
        };
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
      } catch (error) {
        console.warn("[Offline] falha ao gravar cache", error);
      }
    }, 3000);
  });

  return () => {
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    if (timer) window.clearTimeout(timer);
    unsubscribe();
  };
}
