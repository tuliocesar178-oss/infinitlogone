import { useEffect,useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
export interface PointMapProps { lat:number|null; lng:number|null; onPoint:(lat:number,lng:number)=>void; }
export default function PointMap({lat,lng,onPoint}:PointMapProps){
 const node=useRef<HTMLDivElement>(null), map=useRef<mapboxgl.Map|null>(null),marker=useRef<mapboxgl.Marker|null>(null),callback=useRef(onPoint);callback.current=onPoint;
 useEffect(()=>{
  const token=import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;if(!node.current||!token)return;
  const instance=new mapboxgl.Map({container:node.current,accessToken:token,style:'mapbox://styles/mapbox/streets-v12',...(lat!=null&&lng!=null?{center:[lng,lat] as [number,number],zoom:17}:{bounds:[[-74,-34],[-34,6]] as [[number,number],[number,number]]})});map.current=instance;
  instance.addControl(new mapboxgl.NavigationControl());instance.on('click',e=>callback.current(e.lngLat.lat,e.lngLat.lng));
  const resize=new ResizeObserver(()=>instance.resize());resize.observe(node.current);
  return()=>{resize.disconnect();marker.current?.remove();marker.current=null;instance.remove();map.current=null;};
 },[]);
 useEffect(()=>{if(!map.current||lat==null||lng==null)return;if(!marker.current){marker.current=new mapboxgl.Marker({draggable:true}).setLngLat([lng,lat]).addTo(map.current);marker.current.on('dragend',()=>{const p=marker.current?.getLngLat();if(p)callback.current(p.lat,p.lng);});}else marker.current.setLngLat([lng,lat]);map.current.easeTo({center:[lng,lat],zoom:17});},[lat,lng]);
 return <div ref={node} aria-label="Ponto do endereço no mapa" className="h-72 w-full overflow-hidden rounded-lg border border-border"/>;
}
