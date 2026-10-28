import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { registrationSchema } from './registration-model';

export const saveOperationalRegistration = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(registrationSchema)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc('is_staff', { _user_id: context.userId });
    if (staff.error || !staff.data) throw new Error('Cadastro permitido somente à equipe operacional.');
    const admin=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(admin.error)throw admin.error;
    if(data.pix_key && !admin.data)throw new Error('Chave PIX exige permissão administrativa.');
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const id = data.id ?? crypto.randomUUID();
    const table = data.kind === 'driver' ? 'drivers' : 'clients';
    const current = await context.supabase.from(table).select('user_id').eq('user_id', id).maybeSingle();
    if (current.error) throw current.error;
    if (data.id && !current.data) throw new Error('Cadastro não encontrado.');
    // Unauthenticated identities are not Auth users; role assignment is a separate admin action.
    if (!data.id) {
      const identity = await db.from('operational_identities').insert({ id });
      if (identity.error) throw identity.error;
    }
    const common = { user_id: id, full_name: data.full_name, city: data.city || null,
      state: data.state || null, address: data.address || null, address_number: data.address_number || null,
      neighborhood: data.neighborhood || null, notes: data.notes || null };
    const result = data.kind === 'driver'
      ? await db.from('drivers').upsert({ ...common, phone: data.phone, email: data.email || null,
        cpf: data.document || null, zip: data.zip_code || null, birth_date: data.birth_date || null,
        license_number: data.license_number || null, license_category: data.license_category || null,
        cnh_expires_at: data.cnh_expires_at || null, rntrc: data.rntrc || null, ...(admin.data?{pix_key:data.pix_key||null}:{}) }, { onConflict: 'user_id' })
      : await context.supabase.from('clients').upsert({ ...common, contact_phone: data.phone, contact_email: data.email || null,
        document: data.document || null, customer_type: data.customer_type, company_name: data.company_name || data.full_name,
        trade_name: data.trade_name || null, zip_code: data.zip_code || null,
        contact_name: data.contact_name || null, contacts: data.contacts }, { onConflict: 'user_id' });
    if (result.error) {
      if (!data.id) await db.from('operational_identities').delete().eq('id',id).is('auth_user_id',null);
      throw new Error(result.error.message);
    }
    if (data.kind === 'driver' && data.plate) {
      const driver = await context.supabase.from('drivers').select('current_vehicle_id').eq('user_id',id).single();
      if (driver.error) throw driver.error;
      const vehicle = { plate: data.plate.toUpperCase().replace(/[^A-Z0-9]/g,''), vehicle_type: data.vehicle_type || null,
        brand: data.brand || null, model: data.model || null, year: data.year || null,
        capacity_kg: data.capacity_kg || null, axles: data.axles || null };
      const saved = driver.data.current_vehicle_id
        ? await context.supabase.from('vehicles').update(vehicle).eq('id',driver.data.current_vehicle_id).select('id').single()
        : await context.supabase.from('vehicles').insert(vehicle).select('id').single();
      if (saved.error) throw new Error('Cadastro salvo; veículo não salvo: '+saved.error.message);
      const assigned=await context.supabase.from('drivers').update({current_vehicle_id:saved.data.id}).eq('user_id',id);
      if(assigned.error) throw new Error('Cadastro salvo; associação do veículo falhou.');
    }
    const profile = await db.from('profiles').update({ full_name:data.full_name,phone:data.phone,address:data.address||null,address_number:data.address_number||null,neighborhood:data.neighborhood||null,city:data.city||null,state:data.state||null,zip_code:data.zip_code||null }).eq('id',id);
    if(profile.error) throw new Error('Cadastro salvo; nome do acesso não atualizado.');
    return { user_id: id };
  });

export const registrationPermissions = createServerFn({ method:'GET' }).middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    const admin=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(admin.error)throw admin.error;
    return {isAdmin:admin.data===true};
  });

export const setClientRegistrationStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(z.object({id:z.string().uuid(),status:z.enum(['pending','active','blocked'])}))
  .handler(async({data,context})=>{
    const admin=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(admin.error||!admin.data)throw new Error('Somente administrador pode alterar situação.');
    const saved=await context.supabase.from('clients').update({registration_status:data.status}).eq('user_id',data.id);
    if(saved.error)throw saved.error;
    return {ok:true};
  });