/** Absence can be deferred, but credential and relationship invariants cannot. */
export function missingEvidenceError(mode: boolean, stage: 'pickup' | 'delivery', values: { cargoPhotos?: number; invoice?: boolean; receiver?: string; deliveryPhotos?: number; signedInvoice?: boolean }): string | null {
  if (mode) return null;
  if (stage === 'pickup' && (!values.cargoPhotos || !values.invoice)) return 'Envie fotos da carga e da nota fiscal.';
  if (stage === 'delivery' && (!values.receiver?.trim() || (!values.deliveryPhotos && !values.signedInvoice))) return 'Informe o recebedor e anexe fotos ou canhoto.';
  return null;
}