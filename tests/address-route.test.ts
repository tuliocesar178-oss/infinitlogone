import { afterEach, expect, test } from 'bun:test';
import { calculateConfirmedRoute } from '../src/lib/addresses/route.server';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const points={fromLat:-23.5,fromLng:-46.6,toLat:-23.6,toLng:-46.7};
test('confirmed points are used for Directions, with duration stored in integer minutes',async()=>{
 let requested='';
 globalThis.fetch=Object.assign(async(input:RequestInfo|URL)=>{requested=String(input);return Response.json({routes:[{distance:12345,duration:4545,geometry:{type:'LineString',coordinates:[[-46.6,-23.5],[-46.7,-23.6]]}}]});}, {preconnect:originalFetch.preconnect});
 const result=await calculateConfirmedRoute(points,'test-connection','test-lovable');
 expect(requested).toContain('-46.6,-23.5;-46.7,-23.6');expect(result.distance).toBe(12.3);expect(result.duration).toBe(76);
});
test('no road route never invents distance or coordinates',async()=>{
 globalThis.fetch=Object.assign(async()=>Response.json({routes:[]}),{preconnect:originalFetch.preconnect});
 await expect(calculateConfirmedRoute(points,'test-connection','test-lovable')).rejects.toThrow('Não foi possível calcular a rota');
});
test('out of range coordinates are rejected before Directions',async()=>{
 await expect(calculateConfirmedRoute({...points,fromLat:91},'test-connection','test-lovable')).rejects.toThrow();
});