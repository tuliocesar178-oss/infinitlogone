import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRolesCached, primaryRole, homeForRole } from "@/lib/roles";
import { ReferenceHome } from "@/components/reference-home";
import { PremiumHome } from "@/components/premium-home";
import { homeDesignQuery, homeDesignSchema } from "@/lib/home-design";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InfinitLog Transportes — Gestão logística sob controle" },
      {
        name: "description",
        content:
          "Transportadora especializada em cargas com rastreamento em tempo real, comprovantes digitais e atendimento direto pela nossa equipe.",
      },
      { property: "og:title", content: "InfinitLog Transportes" },
      {
        property: "og:description",
        content: "Fale com a nossa equipe, feche seu frete e acompanhe sua carga em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { design?: "current" | "premium-map" } => {
    const parsed = homeDesignSchema.safeParse(search.design);
    return parsed.success ? { design: parsed.data } : {};
  },
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const { design: preview } = Route.useSearch();
  const settings = useQuery(homeDesignQuery);
  const design = preview ?? settings.data?.design ?? 'current';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !preview) {
        getUserRolesCached(data.session.user.id).then(roles => {
          const target = homeForRole(primaryRole(roles));
          navigate({ to: target, replace: true });
        });
      }
    });
  }, [navigate, preview]);

  if (design === "premium-map") return <PremiumHome />;

  return <ReferenceHome />;
}
