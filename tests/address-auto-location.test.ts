import { describe, expect, test } from 'bun:test';
import { applyLocatedAddress, locateAddress, locationAttempts, locationKey } from '../src/lib/addresses/auto-location';
import { emptyAddress, changeAddress, addressError, type AddressSuggestion } from '../src/lib/addresses/model';
const address={...emptyAddress,zip:'33026-000',street:'Rua Maria Piedade Moreira',number:'1000',city:'Santa Luzia',state:'MG'};
const city: AddressSuggestion={id:'city',label:'Santa Luzia, MG',street:'',number:'',neighborhood:'',city:'Santa Luzia',state:'MG',zip:'',lat:-19.769,lng:-43.851,exact:false,featureType:'place'};
describe('automatic freight address location',()=>{
 test('Santa Luzia example includes 1000 and falls back to CEP then city',async()=>{
  const attempts=locationAttempts(address);
  expect(attempts.map(a=>a.source)).toEqual(['address','postcode','city']);
  expect(attempts[0]?.query).toContain('Rua Maria Piedade Moreira, 1000');
  expect(attempts[1]?.query).toBe('33026-000, Santa Luzia, MG, Brasil');
  const result=await locateAddress(address,async()=>[city]);
  expect(result?.source).toBe('city');
  if(!result)throw new Error('No location');
  expect(applyLocatedAddress(address,result).precision).toBe('approximate');
  expect(applyLocatedAddress(address,result).lat).toBe(-19.769);
 });
 test('CEP without street initiates lookup',()=>{expect(locationAttempts({...emptyAddress,zip:'33026-000'})).toEqual([{query:'33026-000, Brasil',source:'postcode'}]);});
 test('without CEP, rural road and no-number addresses still use street then neighborhood and city',()=>{
  const a={...address,zip:'',street:'Estrada Rural',number:'',noNumber:true,neighborhood:'Zona Rural'};
  expect(locationAttempts(a).map(v=>v.source)).toEqual(['address','neighborhood','city']);
  expect(locationAttempts(a)[0]?.query).toContain('Estrada Rural');
  expect(locationAttempts(a)[0]?.query).not.toContain('1000');
 });
 test('all typed fields survive approximate result and cannot authorize route',()=>{
  const next=applyLocatedAddress(address,{suggestion:city,source:'city',query:'Santa Luzia, MG, Brasil'});
  expect(next.street).toBe('Rua Maria Piedade Moreira');expect(next.number).toBe('1000');expect(next.zip).toBe('33026-000');
  expect(addressError(next)).not.toBeNull();
 });
 test('exact location requires exact matching number',()=>{
  const s={...city,featureType:'address',street:address.street,number:'1000',exact:true};
  expect(applyLocatedAddress(address,{suggestion:s,source:'address',query:'x'}).precision).toBe('address');
  expect(applyLocatedAddress(address,{suggestion:{...s,number:'100'},source:'address',query:'x'}).precision).toBe('approximate');
 });
 test('old requests are discarded before fallback',async()=>{
  let current=true,calls=0;
  const result=await locateAddress(address,async()=>{calls++;current=false;return [city];},()=>current);
  expect(result).toBeNull();expect(calls).toBe(1);
 });
 test('CEP changes invalidate confirmation and distinguish request identity',()=>{
  const original={...address,lat:-19.769,lng:-43.851,precision:'manual' as const};
  const changed=changeAddress(original,{zip:'33010-000'});
  expect(changed.lat).toBeNull();expect(changed.precision).toBe('unconfirmed');expect(locationKey(changed)).not.toBe(locationKey(original));
 });
 test('pickup and delivery geocoding remain independent and reject another city',async()=>{
  const destination={...address,city:'Belo Horizonte'};
  const [pickup,delivery]=await Promise.all([locateAddress(address,async()=>[city]),locateAddress(destination,async()=>[city])]);
  expect(pickup?.suggestion.city).toBe('Santa Luzia');expect(delivery).toBeNull();
 });
});