import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const CACHE_KEY = "infinitlog-offline-cache";
const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 dias de dados offline

/**
 * Persiste o cache de consultas no dispositivo para que fretes, rotas e
 * documentos já sincronizados continuem visíveis sem internet.
 * Retorna a função de limpeza da persistência.
 */
export function enableOfflinePersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: CACHE_KEY,
      throttleTime: 2000,
    });
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: MAX_AGE,
      buster: "v1",
    });
    return unsubscribe;
  } catch (error) {
    console.warn("[Offline] não foi possível persistir o cache", error);
    return () => {};
  }
}
