import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getClientOrderEvidence } from "@/lib/client-tracking.functions";

interface EvidenceImageProps {
  attachmentId: string;
  orderId: string;
  initialUrl: string | null;
  alt: string;
  className?: string;
  refreshOnMount?: boolean;
  onUrlChange?: (url: string) => void;
  style?: React.CSSProperties;
}

export function EvidenceImage({
  attachmentId,
  orderId,
  initialUrl,
  alt,
  className,
  refreshOnMount = false,
  onUrlChange,
  style,
}: EvidenceImageProps) {
  const fetchEvidence = useServerFn(getClientOrderEvidence);
  const [url, setUrl] = useState(initialUrl);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const refreshed = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await fetchEvidence({ data: { orderId } });
      const freshUrl = result.evidence.find((entry) => entry.id === attachmentId)?.url;
      if (!freshUrl) throw new Error("Não foi possível gerar um novo endereço para esta imagem.");
      setUrl(freshUrl);
      onUrlChange?.(freshUrl);
      return true;
    } catch (error) {
      console.error("Falha ao renovar a imagem do comprovante:", { attachmentId, error });
      setFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [attachmentId, fetchEvidence, onUrlChange, orderId]);

  useEffect(() => {
    setUrl(initialUrl);
    setFailed(false);
    refreshed.current = false;
    if (refreshOnMount || !initialUrl) void refresh();
  }, [attachmentId, initialUrl, refresh, refreshOnMount]);

  function handleImageError() {
    if (!refreshed.current) {
      refreshed.current = true;
      void refresh();
      return;
    }
    setFailed(true);
  }

  if (failed || !url) {
    return (
      <div className={`grid min-h-24 place-items-center gap-2 bg-secondary/30 p-3 text-center ${className ?? ""}`} role="status">
        <span className="text-sm text-muted-foreground">Não foi possível carregar esta imagem</span>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => { refreshed.current = false; void refresh(); }}>
          {loading ? "Tentando…" : "Tentar novamente"}
        </Button>
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} style={style} onError={handleImageError} />;
}