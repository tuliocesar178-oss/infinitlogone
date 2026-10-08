import { useEffect, useState } from "react";
import { Check, Eye, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type HomeDesign = "current" | "premium-map";

const SETTING_KEY = "public_home_design";

const designs: {
  id: HomeDesign;
  name: string;
  description: string;
  previewClass: string;
}[] = [
  {
    id: "current",
    name: "Design atual",
    description: "Página inicial institucional já publicada.",
    previewClass: "bg-gradient-to-br from-background via-surface-2 to-accent",
  },
  {
    id: "premium-map",
    name: "Mapa Logístico Premium",
    description: "Hero com rastreamento, rotas e identidade visual logística.",
    previewClass: "bg-gradient-to-br from-blue-100 via-background to-primary/20",
  },
];

export function HomeDesignSettings() {
  const [selected, setSelected] = useState<HomeDesign>("current");
  const [saved, setSaved] = useState<HomeDesign>("current");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDesign() {
      const localValue = readLocalDesign();

      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", SETTING_KEY)
          .maybeSingle();

        const databaseValue = getDesignValue(data?.value);
        const value = databaseValue ?? localValue ?? "current";

        if (mounted) {
          setSelected(value);
          setSaved(value);
        }
      } catch {
        if (mounted) {
          setSelected(localValue ?? "current");
          setSaved(localValue ?? "current");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadDesign();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveDesign() {
    setMessage("");

    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTING_KEY,
        value: { design: selected },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      // Mantém uma cópia local para que a escolha continue disponível
      // mesmo quando a política de configuração ainda não estiver publicada.
      writeLocalDesign(selected);
      setMessage("Design salvo neste navegador. A configuração central não está disponível.");
      setSaved(selected);
      return;
    }

    writeLocalDesign(selected);
    setSaved(selected);
    setMessage("Design da página inicial salvo.");
  }

  function restorePrevious() {
    setSelected(saved);
    setMessage("A seleção anterior foi restaurada. Clique em Salvar alterações para confirmar.");
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Design da Página Inicial</CardTitle>
          <CardDescription>Carregando as opções disponíveis...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalização do Site</CardTitle>
        <CardDescription>
          Escolha apenas o visual da página inicial pública. Os portais internos permanecem inalterados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold">Design da Página Inicial</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pré-visualize um tema antes de aplicá-lo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {designs.map((design) => {
            const active = selected === design.id;

            return (
              <div
                key={design.id}
                className={`overflow-hidden rounded-2xl border ${
                  active ? "border-brand ring-2 ring-brand/20" : "border-border"
                }`}
              >
                <div className={`relative h-32 ${design.previewClass}`}>
                  <div className="absolute inset-x-5 top-5 h-3 rounded-full bg-primary/80" />
                  <div className="absolute left-5 top-14 h-3 w-2/5 rounded-full bg-primary/30" />
                  <div className="absolute bottom-5 right-5 h-12 w-24 rounded-xl border border-white/70 bg-white/70 shadow-sm" />
                  {active && (
                    <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-brand text-brand-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h4 className="font-semibold">{design.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{design.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setSelected(design.id)}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {active ? "Selecionado" : "Aplicar design"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        window.open(`/?design=${design.id}`, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Pré-visualizar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button type="button" onClick={() => void saveDesign()}>
            <Save className="mr-2 h-4 w-4" />
            Salvar alterações
          </Button>
          <Button type="button" variant="outline" onClick={restorePrevious}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar design anterior
          </Button>
          {message && <span className="text-sm text-muted-foreground">{message}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function getDesignValue(value: unknown): HomeDesign | null {
  if (!value || typeof value !== "object" || !("design" in value)) return null;
  const design = (value as { design?: unknown }).design;
  return design === "premium-map" || design === "current" ? design : null;
}

function readLocalDesign(): HomeDesign | null {
  try {
    const value = window.localStorage.getItem(SETTING_KEY);
    return value === "premium-map" || value === "current" ? value : null;
  } catch {
    return null;
  }
}

function writeLocalDesign(value: HomeDesign) {
  try {
    window.localStorage.setItem(SETTING_KEY, value);
  } catch {
    // O banco continua sendo a fonte principal quando o armazenamento local não existe.
  }
}