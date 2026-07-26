import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Link2, Mail, MessageCircle, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { shareMessage, trackingUrl } from "@/lib/order-status";

export function ShareTracking({ code, phone }: { code: string; phone?: string | null }) {
  const [qrOpen, setQrOpen] = useState(false);
  const url = trackingUrl(code);
  const message = shareMessage(code);

  const whatsappHref = (() => {
    const digits = (phone ?? "").replace(/\D/g, "");
    const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(message)}`;
  })();

  const mailHref = `mailto:?subject=${encodeURIComponent(
    "Rastreio do seu frete — InfinitLog Transportes",
  )}&body=${encodeURIComponent(message)}`;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener"
          className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> Compartilhar no WhatsApp
        </a>
        <button
          onClick={() => copy(url, "Link")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
        >
          <Link2 className="h-4 w-4" /> Copiar link
        </button>
        <button
          onClick={() => copy(code, "Código")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
        >
          <Copy className="h-4 w-4" /> Copiar código
        </button>
        <button
          onClick={() => setQrOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
        >
          <QrCode className="h-4 w-4" /> Ver QR Code
        </button>
        <a
          href={mailHref}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
        >
          <Mail className="h-4 w-4" /> Enviar por e-mail
        </a>
      </div>

      {qrOpen && <QrModal code={code} url={url} onClose={() => setQrOpen(false)} />}
    </>
  );
}

function QrModal({ code, url, onClose }: { code: string; url: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 320, margin: 2 });
  }, [url]);

  async function download() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qrcode-${code}.png`;
    a.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">QR Code do pedido</h3>
            <p className="mt-1 text-xs text-muted-foreground">Ao escanear, abre o rastreamento.</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid place-items-center rounded-2xl bg-white p-4">
          <canvas ref={canvasRef} />
        </div>
        <div className="mt-3 rounded-xl bg-surface-2 p-3 text-center font-mono text-sm">{code}</div>
        <button
          onClick={download}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Baixar QR Code
        </button>
      </div>
    </div>
  );
}
