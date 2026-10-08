import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatWorkspace } from '@/components/chat/workspace';

export interface DriverQuickChatProps {
  orderId: string;
  orderCode?: string | null;
  open: boolean;
  onClose: () => void;
}
export function DriverQuickChat({ orderId, open, onClose }: DriverQuickChatProps) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80" role="dialog" aria-modal="true" aria-label="Meus chats">
    <div className="w-full max-w-3xl border bg-background shadow-elevated">
      <div className="flex justify-end border-b p-2"><Button variant="ghost" size="icon" aria-label="Fechar chat" onClick={onClose}><X className="h-5 w-5" /></Button></div>
      <ChatWorkspace orderId={orderId} />
    </div>
  </div>;
}
