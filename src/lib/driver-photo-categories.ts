export const EXTRA_PHOTO_CATEGORIES = [
  { value: "chegada_coleta", label: "Chegada ao local de coleta", kind: "chegada_coleta" },
  { value: "carregamento", label: "Carregamento", kind: "foto_carga" },
  { value: "nota_fiscal", label: "Nota fiscal", kind: "foto_nf" },
  { value: "chegada_entrega", label: "Chegada ao local de entrega", kind: "chegada_entrega" },
  { value: "carga_entrega", label: "Carga no local de entrega", kind: "carga_entrega" },
  { value: "canhoto_legivel", label: "Canhoto datado, assinado e legível", kind: "canhoto" },
] as const;
export function driverPhotoCategories(stage: "pickup" | "delivery") {
  const original = stage === "pickup" ? [{ value: "foto_carga", label: "Fotos da carga (múltiplas)", kind: "foto_carga" }, { value: "foto_nf", label: "Foto da nota fiscal", kind: "foto_nf" }] : [{ value: "canhoto", label: "Canhoto / NF assinada", kind: "canhoto" }, { value: "foto_entrega", label: "Fotos da entrega", kind: "foto_entrega" }];
  return [...original, ...EXTRA_PHOTO_CATEGORIES];
}
export interface DriverPhotoSelection { id: string; file: File; category: string; kind: string; label: string; }
export function appendDriverPhotos(previous: DriverPhotoSelection[], incoming: DriverPhotoSelection[]) { return [...previous, ...incoming]; }
export function driverPhotoPath(orderId: string, id: string, fileName: string) { return `${orderId}/driver-photo-${id}-${fileName.replace(/[^\w.\-]/g, "_")}`; }