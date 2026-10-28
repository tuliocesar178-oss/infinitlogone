import { z } from 'zod';

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (/^[1-9]\d{9,10}$/.test(digits)) return `+55${digits}`;
  if (/^55[1-9]\d{9,10}$/.test(digits)) return `+${digits}`;
  throw new Error('Informe telefone brasileiro com DDD.');
}
export function canReceiveOffer(status: string | null, deletedAt: string | null = null): boolean {
  return status === 'active' && deletedAt === null;
}
const text = z.string().trim().max(200).default('');
const phoneSchema=z.string().transform((value,ctx)=>{
  try{return normalizePhone(value);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'Informe telefone brasileiro com DDD.'});return z.NEVER;}
});
export const registrationSchema = z.object({
  id: z.string().uuid().optional(), kind: z.enum(['driver', 'client']),
  full_name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.union([z.literal(''), z.string().trim().email()]).default(''),
  document: text, city: text, state: z.string().trim().max(2).default(''),
  address: text, address_number: text, neighborhood: text, zip_code: text,
  notes: z.string().trim().max(4000).default(''),
  customer_type: z.enum(['pf', 'pj']).default('pj'), company_name: text, trade_name: text,
  contact_name: text,
  contacts: z.array(z.object({ name: text, phone: phoneSchema, email: z.union([z.literal(''),z.string().email()]).default('') })).max(30).default([]),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
  license_number: text, license_category: text, cnh_expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
  rntrc: text, pix_key: text,
  vehicle_type: text, brand: text, model: text, plate: z.string().trim().max(12).default(''),
  year: z.coerce.number().int().min(0).max(2100).default(0),
  capacity_kg: z.coerce.number().min(0).max(1000000).default(0), axles: z.coerce.number().int().min(0).max(30).default(0),
});
export type RegistrationInput = z.input<typeof registrationSchema>;