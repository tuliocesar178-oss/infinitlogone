import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { saveBoardSettings } from "@/lib/operation-board.functions";
import { monitoringSchema, type MonitoringSettings } from "@/lib/operation-board-monitor";
export function BoardSettings({settings}:{settings:MonitoringSettings}) {
  const [open,setOpen]=useState(false),[values,setValues]=useState(settings); const qc=useQueryClient(),save=useServerFn(saveBoardSettings);
  const mutation=useMutation({mutationFn:()=>save({data:monitoringSchema.parse(values)}),onSuccess:async()=>{await qc.invalidateQueries({queryKey:["operation-board"]});setOpen(false);}});
  const fields:{key:keyof MonitoringSettings;label:string;min:number;max:number}[]=[{key:"stopMinutes",label:"Parada prolongada (min)",min:5,max:120},{key:"gpsMinutes",label:"Sem GPS (min)",min:1,max:60},{key:"deviationMeters",label:"Tolerância de desvio (m)",min:100,max:5000},{key:"confirmationMinutes",label:"Confirmação de desvio (min)",min:1,max:30},{key:"accuracyMeters",label:"Precisão GPS máxima (m)",min:10,max:200},{key:"movementMeters",label:"Tolerância de deslocamento parado (m)",min:20,max:500},{key:"deadlineMinutes",label:"Atenção antes do prazo (min)",min:5,max:240}];
  return <><Button variant="outline" size="icon" title="Critérios de monitoramento" aria-label="Critérios de monitoramento" onClick={()=>{setValues(settings);setOpen(true);}}><Settings2/></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Critérios de monitoramento</DialogTitle><form onSubmit={e=>{e.preventDefault();mutation.mutate();}} className="space-y-3">{fields.map(f=><label key={f.key} className="flex items-center justify-between gap-3 text-sm">{f.label}<input type="number" required min={f.min} max={f.max} value={values[f.key]} onChange={e=>setValues(v=>({...v,[f.key]:Number(e.target.value)}))} className="h-10 w-24 rounded-md border border-input bg-background px-2"/></label>)}{mutation.isError && <p role="alert" className="text-destructive">Não foi possível salvar. Verifique os limites e tente novamente.</p>}<Button type="submit" disabled={mutation.isPending}><Save/>Salvar critérios</Button></form></DialogContent></Dialog></>;
}