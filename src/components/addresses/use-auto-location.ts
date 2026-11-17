import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { searchFreightAddress } from '@/lib/addresses/geocoding.functions';
import { applyLocatedAddress, locateAddress, locationAttempts, locationKey, type LocatedAddress } from '@/lib/addresses/auto-location';
import type { FreightAddress } from '@/lib/addresses/model';

export function useAutoLocation(value: FreightAddress, onChange: (a: FreightAddress) => void) {
  const search = useServerFn(searchFreightAddress);
  const client = useQueryClient();
  const latest = useRef(value); latest.current=value;
  const change = useRef(onChange); change.current=onChange;
  const generation=useRef(0);
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [located,setLocated]=useState<LocatedAddress|null>(null);
  const [showMap,setShowMap]=useState(value.lat!=null && value.lng!=null);
  const key=locationKey(value);
  const searchRef=useRef(search); searchRef.current=search;

  const cancel=()=>{generation.current+=1;setChecking(false);setError(null);};
  async function run(snapshot: FreightAddress, revision: number) {
    const signature=locationKey(snapshot);
    const current=()=>generation.current===revision && locationKey(latest.current)===signature;
    if (!current()) return;
    setChecking(true);setError(null);
    try {
      const result=await locateAddress(snapshot,query=>client.fetchQuery({
        queryKey:['freight-address-search',query],
        queryFn:()=>searchRef.current({data:{query}}),staleTime:60000,retry:false,
      }),current);
      if (!current()) return;
      if (!result) {setError('Não foi possível localizar automaticamente. Ajuste e confirme o ponto no mapa.');return;}
      setLocated(result);setShowMap(true);
      change.current(applyLocatedAddress(latest.current,result));
    } catch {
      if(current())setError('Não foi possível localizar automaticamente. Você pode ajustar o ponto no mapa.');
    } finally {if(current())setChecking(false);}
  }
  const runRef=useRef(run);runRef.current=run;
  useEffect(()=>{
    const revision=++generation.current;
    setLocated(null);setError(null);setChecking(false);
    const snapshot=latest.current;
    if (['manual','address'].includes(snapshot.precision) || !locationAttempts(snapshot).length) return;
    const timer=setTimeout(()=>void runRef.current(snapshot,revision),800);
    return ()=>{clearTimeout(timer);generation.current+=1;};
  },[key]);
  useEffect(()=>()=>{generation.current+=1;},[]);
  const verify=()=>{const revision=++generation.current;void runRef.current(latest.current,revision);};
  return {checking,error,located,showMap,setShowMap,cancel,verify};
}