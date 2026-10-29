import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface PasswordFieldProps extends Omit<ComponentProps<typeof Input>, 'type'> { label: string }

/** Password input with an accessible show/hide toggle. */
export function PasswordField({ label, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <label className="grid min-w-0 gap-1.5 text-sm"><span>{label}</span>
    <span className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  </label>;
}
