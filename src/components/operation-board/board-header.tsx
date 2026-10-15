import { Link } from "@tanstack/react-router";
import { Maximize2, Minimize2, Radio, RotateCw } from "lucide-react";
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
}

export function BoardHeader(props: BoardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-surface px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex items-center gap-4">
        <Logo size={150} withWordmark />
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Painel de Operação</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-success"><Radio className="h-4 w-4" /> Sistema online</div>
        <span className="text-muted-foreground">Atualizado há {props.updatedSeconds}s</span>
        <time className="font-mono text-base font-semibold tabular-nums">
          {props.now.toLocaleDateString("pt-BR")} · {props.now.toLocaleTimeString("pt-BR")}
        </time>
        <label className="flex items-center gap-2 text-muted-foreground">
          <RotateCw className="h-4 w-4" />
          <input type="checkbox" checked={props.rotation} onChange={(event) => props.onRotation(event.target.checked)} /> Rotação
        </label>
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