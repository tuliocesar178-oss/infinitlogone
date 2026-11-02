import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/mapa")({
  head: () => ({ meta: [{ title: 'client · mapa — INFINITLOG' }, { name: "description", content: 'client · mapa — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'client · mapa — INFINITLOG' }, { property: "og:description", content: 'client · mapa — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  beforeLoad: () => {
    // Redireciona para o index que agora é a tela de rastreamento principal.
    throw redirect({ to: "/client" });
  },
});
