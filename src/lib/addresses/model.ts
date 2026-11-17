import { z } from 'zod';
export const addressSchema = z.object({ street: z.string(), number: z.string(), noNumber: z.boolean(), complement: z.string(), neighborhood: z.string(), city: z.string(), state: z.string(), zip: z.string(), reference: z.string(), lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(), precision: z.enum(['unconfirmed','approximate','address','manual']) });
export type FreightAddress = z.infer<typeof addressSchema>;
export const emptyAddress: FreightAddress = { street:'',number:'',noNumber:false,complement:'',neighborhood:'',city:'',state:'',zip:'',reference:'',lat:null,lng:null,precision:'unconfirmed' };
export function fullAddress(a: FreightAddress) { return [a.street, a.noNumber ? 's/n' : a.number, a.complement, a.neighborhood, [a.city,a.state].filter(Boolean).join('/'), a.zip].filter(Boolean).join(', '); }
export function formatZip(value: string): string { const digits=value.replace(/\D/g,'').slice(0,8); return digits.length>5?`${digits.slice(0,5)}-${digits.slice(5)}`:digits; }
export function zipWarning(value: string): string | null { return value && value.replace(/\D/g,'').length!==8 ? 'CEP incompleto ou inválido. Você pode continuar preenchendo o endereço manualmente.' : null; }
export function addressQuery(a: FreightAddress) { return [a.street,a.noNumber ? '' : a.number,a.neighborhood,a.city,a.state,!a.street && !zipWarning(a.zip)?a.zip:'','Brasil'].filter(Boolean).join(', '); }
export function addressError(a: FreightAddress): string | null {
 if (!a.street.trim() || !a.city.trim() || !/^[A-Z]{2}$/.test(a.state)) return 'Informe rua, cidade e UF.';
 if (!a.noNumber && !a.number.trim()) return 'Informe o número do imóvel ou marque Sem número.';
 if (a.noNumber && !a.reference.trim() && a.precision !== 'manual') return 'Sem número exige referência ou ponto confirmado no mapa.';
 if (a.lat == null || a.lng == null || !['address','manual'].includes(a.precision)) return 'Confirme a localização do imóvel ou ajuste o ponto no mapa.';
 return null;
}
export function changeAddress(a: FreightAddress, patch: Partial<FreightAddress>): FreightAddress {
 const keys: (keyof FreightAddress)[] = ['zip','street','number','noNumber','neighborhood','city','state'];
 return { ...a,...patch,...(keys.some(k => k in patch && patch[k] !== a[k]) ? { lat:null,lng:null,precision:'unconfirmed' as const } : {}) };
}
export interface AddressSuggestion { id:string; label:string; street:string; number:string; neighborhood:string; city:string; state:string; zip:string; lat:number; lng:number; exact:boolean; featureType?:string; }
export function chooseSuggestion(a: FreightAddress,s: AddressSuggestion): FreightAddress {
 const number = a.number || s.number;
 const exact = !a.noNumber && s.exact && !!number && number.toLocaleLowerCase() === s.number.toLocaleLowerCase();
 return { ...a,street:s.street||a.street,number,neighborhood:s.neighborhood||a.neighborhood,city:s.city||a.city,state:s.state||a.state,zip:a.zip||(s.zip.replace(/\D/g,'').length===8?formatZip(s.zip):''),lat:s.lat,lng:s.lng,precision:exact?'address':'approximate' };
}
