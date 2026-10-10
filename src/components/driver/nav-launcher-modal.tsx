import { Link } from '@tanstack/react-router';
import { NAV_PROVIDERS, buildNavUrl, type NavTarget } from '@/lib/nav-launcher';
import { Navigation, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export interface NavLauncherModalProps { open: boolean; target: NavTarget | null; onClose: () => void; onInternal?: () => void; origin?: { lat: number; lng: number }; }
export function NavLauncherModal({ open, target, onClose, onInternal, origin }: NavLauncherModalProps) {
  if (!target) return null;
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Escolher aplicativo de navegação</DialogTitle><DialogDescription>{target.label ?? 'Destino do frete'}</DialogDescription></DialogHeader>
    <div className="grid gap-2">{NAV_PROVIDERS.map(provider => {
      if (provider.key === 'mapbox') return onInternal ? <Button key={provider.key} onClick={() => { onInternal(); onClose(); }}><Navigation />Continuar no Mapbox</Button> : target.orderId ? <Button key={provider.key} asChild><Link to="/driver/navegacao/$id" params={{ id: target.orderId }} onClick={onClose}><Navigation />Continuar no Mapbox</Link></Button> : null;
      return <Button key={provider.key} variant="outline" className="h-auto justify-between py-3" asChild><a href={buildNavUrl(provider.key, target, origin)} target="_blank" rel="noopener noreferrer"><span>{provider.label}<span className="block text-xs text-muted-foreground">{provider.hint}</span></span><ExternalLink className="h-4 w-4" /></a></Button>;
    })}</div><p className="text-xs text-muted-foreground">Ao sair, o GPS da INFINITLOG pode pausar. O frete não será concluído. Se o aplicativo não abrir, utilize a opção web oferecida.</p>
  </DialogContent></Dialog>;
}
