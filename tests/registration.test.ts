import { describe, it, expect } from 'bun:test';
import { normalizePhone, registrationSchema, canReceiveOffer } from '../src/lib/registration-model';

describe('cadastro operacional',()=>{
  it('normaliza todas as formatações informadas para um único telefone',()=>{
    for(const phone of ['(31) 99999-9999','31999999999','+55 31 99999-9999']) expect(normalizePhone(phone)).toBe('+5531999999999');
  });
  it('telefone é obrigatório',()=>{expect(registrationSchema.safeParse({kind:'driver',full_name:'Motorista',phone:''}).success).toBe(false);});
  it('motorista sem email e sem conta pode ser cadastrado',()=>{
    const saved=registrationSchema.parse({kind:'driver',full_name:'Motorista',phone:'31999999999'});
    expect(saved.email).toBe('');expect(saved.id).toBeUndefined();
  });
  it('cliente sem email e sem verificação pode ser cadastrado',()=>{
    const saved=registrationSchema.parse({kind:'client',full_name:'Cliente',phone:'31999999999'});
    expect(saved.phone).toBe('+5531999999999');expect(saved.email).toBe('');
  });
  it('somente aprovados recebem ofertas automáticas',()=>{
    expect(canReceiveOffer('active')).toBe(true);
    for(const status of ['pending','correction','rejected',null])expect(canReceiveOffer(status)).toBe(false);
    expect(canReceiveOffer('active','2026-10-28')).toBe(false);
  });
  it('dados de veículo sem placa não são silenciosamente descartados',()=>{
    expect(registrationSchema.safeParse({kind:'driver',full_name:'Motorista',phone:'31999999999',brand:'Volvo'}).success).toBe(false);
  });
  it('contatos empresariais mantêm telefone normalizado',()=>{
    const client=registrationSchema.parse({kind:'client',full_name:'Empresa',phone:'31999999999',contacts:[{name:'Contato',phone:'(31) 98888-8888'}]});
    expect(client.contacts[0]?.phone).toBe('+5531988888888');
  });
});