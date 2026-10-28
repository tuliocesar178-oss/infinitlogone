import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface RegistrationFieldProps extends ComponentProps<typeof Input> {label:string}
export function RegistrationField({label,className,...props}:RegistrationFieldProps){
  return <label className="grid min-w-0 gap-1.5 text-sm"><span>{label}</span><Input {...props} className={cn('min-w-0',className)}/></label>;
}