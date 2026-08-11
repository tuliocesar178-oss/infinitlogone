import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/mapa")({
  beforeLoad: () => {
    // Redireciona para o index que agora é a tela de rastreamento principal.
    throw redirect({ to: "/client" });
  },
});
