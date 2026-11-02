import { useRef, useState, useEffect } from "react";
import { Camera, ImagePlus, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driverPhotoCategories, appendDriverPhotos, type DriverPhotoSelection } from "@/lib/driver-photo-categories";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export interface EvidencePhotoPickerProps { stage: "pickup" | "delivery"; orderId: string; items: DriverPhotoSelection[]; onChange: (items: DriverPhotoSelection[]) => void; disabled?: boolean; }
export function EvidencePhotoPicker({ stage, orderId, items, onChange, disabled }: EvidencePhotoPickerProps) {
  const categories = driverPhotoCategories(stage);
  const [category, setCategory] = useState(categories[0].value);
  const [replace, setReplace] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null);
  const selected = categories.find(c => c.value === category) ?? categories[0];
  const history = useQuery({ queryKey: ["driver-evidence-history", orderId], queryFn: async () => {
    const r = await supabase.from("order_attachments").select("id,kind,label,file_path,mime_type,metadata").eq("order_id", orderId).order("created_at", { ascending: false });
    if (r.error) throw r.error;
    return Promise.all((r.data ?? []).map(async item => { const signed = await supabase.storage.from("order-files").createSignedUrl(item.file_path, 300); return { ...item, url: signed.data?.signedUrl }; }));
  } });
  function add(files: File[]) {
    const incoming = files.map(file => ({ id: crypto.randomUUID(), file, category: selected.value, kind: selected.kind, label: selected.label }));
    onChange(appendDriverPhotos(replace ? items.filter(i => i.id !== replace) : items, incoming));
    setReplace(null);
  }
  return <div className="space-y-3">
    <select aria-label="Tipo de foto ou comprovante" value={category} disabled={disabled} onChange={e => setCategory(e.target.value)} className="h-11 w-full rounded-md border border-input bg-surface px-3 text-sm">{categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
    {selected.kind === "canhoto" && <p className="text-sm text-warning">Confira se a data, a assinatura e todas as informações estão legíveis antes de enviar</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled} onClick={() => { setReplace(null); camera.current?.click(); }}><Camera />Tirar foto</Button><Button variant="outline" disabled={disabled} onClick={() => { setReplace(null); gallery.current?.click(); }}><ImagePlus />Galeria / arquivo</Button></div>
    <input ref={camera} aria-label="Capturar foto" type="file" hidden accept="image/*" capture="environment" onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    <input ref={gallery} aria-label="Selecionar imagens" type="file" hidden accept="image/*,application/pdf" multiple onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    <div className="space-y-2">{items.map(item => <div key={item.id} className="flex min-w-0 items-center gap-2 border-b border-border py-2"><PhotoPreview file={item.file} /><div className="min-w-0 flex-1"><p className="text-sm">{item.label}</p><p className="truncate text-xs text-muted-foreground">{item.file.name}</p></div><Button aria-label={`Substituir ${item.file.name}`} variant="ghost" size="icon" disabled={disabled} onClick={() => { setReplace(item.id); setCategory(item.category); gallery.current?.click(); }}><RefreshCw /></Button><Button aria-label={`Remover ${item.file.name}`} variant="ghost" size="icon" disabled={disabled} onClick={() => onChange(items.filter(i => i.id !== item.id))}><X /></Button></div>)}</div>
    {history.error && <p role="alert" className="text-sm text-destructive">Não foi possível consultar as fotos enviadas.</p>}
    {(history.data ?? []).map(item => <Button key={item.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => item.url ? window.open(item.url, "_blank", "noopener,noreferrer") : toast.error("Não foi possível abrir o arquivo.")}>{item.mime_type?.startsWith("image/") && item.url && <img src={item.url} alt="" className="h-12 w-12 rounded-md object-cover" />}<span>{item.label ?? item.kind} · Enviado</span></Button>)}
  </div>;
}
function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (!file.type.startsWith("image/")) return; const objectUrl = URL.createObjectURL(file); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [file]);
  return url ? <img src={url} alt={file.name} className="h-12 w-12 shrink-0 rounded-md object-cover" /> : null;
}