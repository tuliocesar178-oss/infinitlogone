import { addressQuery, type AddressSuggestion, type FreightAddress } from './model';

export type LocationSource = 'address' | 'postcode' | 'neighborhood' | 'city';
export interface LocationAttempt { query: string; source: LocationSource; }
export interface LocatedAddress { suggestion: AddressSuggestion; source: LocationSource; query: string; }
export function locationKey(a: FreightAddress): string {
  return JSON.stringify([a.zip,a.street,a.number,a.noNumber,a.neighborhood,a.city,a.state]);
}
export function locationAttempts(a: FreightAddress): LocationAttempt[] {
  const attempts: LocationAttempt[] = [];
  const city = a.city.trim(), state = a.state.trim();
  const postal = a.zip.replace(/\D/g,'');
  if (a.street.trim() && city && state.length === 2) attempts.push({query: addressQuery(a), source:'address'});
  if (postal.length === 8) attempts.push({query:[a.zip,city,state,'Brasil'].filter(Boolean).join(', '),source:'postcode'});
  if (a.neighborhood.trim() && city && state.length === 2) attempts.push({query:[a.neighborhood,city,state,'Brasil'].join(', '),source:'neighborhood'});
  if (city && state.length === 2) attempts.push({query:[city,state,'Brasil'].join(', '),source:'city'});
  return attempts;
}
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase();
export function matchingLocation(a: FreightAddress, s: AddressSuggestion): boolean {
  return (!a.city.trim() || normalize(s.city) === normalize(a.city)) && (!a.state.trim() || s.state.toUpperCase() === a.state.toUpperCase());
}
export async function locateAddress(a: FreightAddress, search: (query: string) => Promise<AddressSuggestion[]>, isCurrent: () => boolean = () => true): Promise<LocatedAddress | null> {
  for (const attempt of locationAttempts(a)) {
    if (!isCurrent()) return null;
    const results = await search(attempt.query);
    if (!isCurrent()) return null;
    const local = results.filter(s => matchingLocation(a,s));
    // An address query can return only a city: do not mislabel that as a street.
    const found = local.find(s => attempt.source !== 'address' || (
      (!s.featureType || ['address','street'].includes(s.featureType)) && normalize(s.street) === normalize(a.street)
    ));
    if (found) {
      // Mapbox may answer a postcode query with a place, not a postcode.
      const source: LocationSource = found.featureType==='place' ? 'city'
        : ['neighborhood','locality'].includes(found.featureType ?? '') ? 'neighborhood'
        : found.featureType==='postcode' ? 'postcode' : attempt.source;
      return {suggestion:found,source,query:attempt.query};
    }
  }
  return null;
}
export function applyLocatedAddress(a: FreightAddress, result: LocatedAddress): FreightAddress {
  const s=result.suggestion;
  const exact=result.source==='address' && s.exact && !a.noNumber && !!a.number.trim() && normalize(a.number)===normalize(s.number);
  // Never replace manually entered postal or street fields with service data.
  return {...a,lat:s.lat,lng:s.lng,precision:exact?'address':'approximate'};
}
export const locationSourceLabel: Record<LocationSource,string> = {
  address:'Localização aproximada pelo endereço',postcode:'Localização aproximada pelo CEP',
  neighborhood:'Localização aproximada pelo bairro',city:'Localização aproximada pela cidade',
};