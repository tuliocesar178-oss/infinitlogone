import { supabase } from '@/integrations/supabase/client';

/** Stable registry identifiers remain the order/work ownership keys before activation. */
export async function loadRegisteredClients() {
  const result=await supabase.from('clients').select('*').is('deleted_at',null).order('company_name');
  if(result.error)throw result.error;
  return (result.data??[]).map(c=>({id:c.user_id,company_name:c.company_name??'',cnpj:c.document??'',
    full_name:c.full_name??'',phone:c.contact_phone??'',whatsapp:c.contact_phone??'',email:c.contact_email??'',
    zip_code:c.zip_code??'',address:c.address??'',address_number:c.address_number??'',neighborhood:c.neighborhood??'',city:c.city??'',state:c.state??''}));
}