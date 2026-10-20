import type { CreateIncident } from './model';

export interface IncidentDraft { id: string; userId: string; payload: CreateIncident; files: { id: string; file: File }[]; incidentId?: string; savedAt: string; }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open('infinitlog-incident-drafts', 1); request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Não foi possível guardar o rascunho neste aparelho.')); });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('drafts', mode); const request = action(tx.objectStore('drafts')); tx.oncomplete = () => { db.close(); resolve(request.result); }; tx.onerror = () => { db.close(); reject(new Error('Não foi possível guardar o rascunho neste aparelho.')); }; tx.onabort = tx.onerror; });
}
export const storeDraft = (draft: IncidentDraft) => transaction('readwrite', store => store.put(draft));
export const removeDraft = (id: string) => transaction('readwrite', store => store.delete(id));
export async function clearUserDrafts(userId: string): Promise<void> { const drafts = await readDrafts(userId); await Promise.all(drafts.map(d => removeDraft(d.id))); }
export async function readDrafts(userId: string): Promise<IncidentDraft[]> { const items = await transaction<IncidentDraft[]>('readonly', store => store.getAll()); return items.filter(d => d.userId === userId); }
/** Compression runs only after selecting a photo; PDFs/documents retain their original bytes. */
export async function compressIncidentImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  try { const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); const ctx = canvas.getContext('2d'); if (!ctx) return file; ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9)); return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file; } finally { bitmap.close(); }
}