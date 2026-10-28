import { useState,type ChangeEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export interface RegistrationPhotoProps {label:string;identityId:string;onSaved:(url:string)=>void}
export function RegistrationPhoto({label,identityId,onSaved}:RegistrationPhotoProps){
  const [uploading,setUploading]=useState(false);
  async function upload(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){toast.error('Use JPG, PNG ou WebP até 10 MB.');return;}
    setUploading(true);
    try{
      const path=`${identityId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
      const saved=await supabase.storage.from('driver-photos').upload(path,file,{contentType:file.type});if(saved.error)throw saved.error;
      const url=supabase.storage.from('driver-photos').getPublicUrl(path).data.publicUrl;onSaved(url);
    }catch(error){toast.error(error instanceof Error?error.message:'Não foi possível enviar foto.');}finally{setUploading(false);e.target.value='';}
  }
  return <label className="grid gap-1.5 text-sm"><span>{label}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={upload}/>{uploading&&<Button disabled variant="ghost">Enviando foto…</Button>}</label>;
}