import { describe, it, expect } from 'bun:test';
import { makeRegistrationSchema, canReceiveOffer } from '../src/lib/registration-model';
import { missingEvidenceError } from '../src/lib/test-mode-model';
import { validateIncidentExplanation } from '../src/lib/incidents/model';

describe('temporary test mode completeness', () => {
  it('saves driver without name, phone or email only while enabled', () => {
    const value = { kind: 'driver', full_name: '', phone: '' };
    expect(makeRegistrationSchema(true).parse(value).email).toBe('');
    expect(makeRegistrationSchema(false).safeParse(value).success).toBe(false);
  });
  it('saves an incomplete client contact without fabricating a phone', () => {
    const value = { kind: 'client', full_name: '', phone: '', contacts: [{name:'',phone:''}] };
    expect(makeRegistrationSchema(true).parse(value).contacts[0]?.phone).toBe('');
    expect(makeRegistrationSchema(false).safeParse(value).success).toBe(false);
  });
  it('does not waive invalid supplied phone numbers', () => {
    expect(makeRegistrationSchema(true).safeParse({kind:'driver',full_name:'',phone:'123'}).success).toBe(false);
  });
  it('preserves vehicle details when plate is pending', () => {
    const value={kind:'driver',full_name:'',phone:'',brand:'Volvo',plate:''};
    expect(makeRegistrationSchema(true).parse(value).brand).toBe('Volvo');
    expect(makeRegistrationSchema(false).safeParse(value).success).toBe(false);
  });
  it('allows pickup with no photos or invoice only in tests', () => {
    expect(missingEvidenceError(true,'pickup',{})).toBeNull();
    expect(missingEvidenceError(false,'pickup',{})).not.toBeNull();
    expect(missingEvidenceError(false,'pickup',{cargoPhotos:1,invoice:true})).toBeNull();
  });
  it('allows delivery with receiver and proof pending only in tests', () => {
    expect(missingEvidenceError(true,'delivery',{})).toBeNull();
    expect(missingEvidenceError(false,'delivery',{})).not.toBeNull();
    expect(missingEvidenceError(false,'delivery',{receiver:'Pessoa',signedInvoice:true})).toBeNull();
  });
  it('restores mandatory incident explanation when disabled', () => {
    const category={value:'other',label:'Outros',priority:'attention' as const,requires_description:true};
    expect(validateIncidentExplanation(category,'',true)).toBe(true);
    expect(validateIncidentExplanation(category,'',false)).toBe(false);
  });
  it('does not approve pending drivers', () => {
    expect(canReceiveOffer('pending')).toBe(false);
    expect(canReceiveOffer('active')).toBe(true);
  });
});