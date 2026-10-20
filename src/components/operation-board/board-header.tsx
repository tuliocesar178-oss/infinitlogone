import { Link } from "@tanstack/react-router";
import { Maximize2, Minimize2, Radio, Pause, Play, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

interface BoardHeaderProps {
  now: Date;
  updatedSeconds: number;
  fullscreen: boolean;
  rotation: boolean;
  interval: number;
  onFullscreen: () => void;
  onRotation: (enabled: boolean) => void;
  onInterval: (seconds: number) => void;
  connected?: boolean;
  updatedAt?: string;
  onPrevious?: () => void;
}

export function BoardHeader(props: BoardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-surface px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex items-center gap-4">
        <Logo size={150} withWordmark />
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Painéis Operacionais</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-muted-foreground"><Radio className="h-4 w-4" /> {props.connected ? "Conectado" : "Reconectando"}</div>
        <span className="text-muted-foreground">{props.updatedAt ? `Atualizado há ${props.updatedSeconds}s` : "Aguardando atualização"}</span>
        <time className="font-mono text-base font-semibold tabular-nums">
          {props.now.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})} · {props.now.toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo"})}
        </time>
        <Button variant="outline" size="icon" title="Painel anterior" aria-label="Painel anterior" onClick={props.onPrevious}><ChevronLeft/></Button>
        <Button variant="outline" size="sm" aria-pressed={props.rotation} onClick={()=>props.onRotation(!props.rotation)}>{props.rotation ? <Pause/>:<Play/>}{props.rotation ? "Pausar":"Apresentar"}</Button>
        <select aria-label="Intervalo da rotação" value={props.interval} onChange={(event) => props.onInterval(Number(event.target.value))} className="h-9 rounded-md border border-input bg-background px-2">
          {[10, 20, 30, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={props.onFullscreen}>
          {props.fullscreen ? <Minimize2 /> : <Maximize2 />} {props.fullscreen ? "Sair" : "Modo TV"}
        </Button>
        {!props.fullscreen && <Button asChild variant="ghost" size="sm"><Link to="/ops/central">Torre de Controle</Link></Button>}
      </div>
    </header>
  );
}