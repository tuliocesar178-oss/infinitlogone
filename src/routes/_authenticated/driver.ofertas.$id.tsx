import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OfferDetails } from "@/components/driver/offer-details";

export const Route = createFileRoute("/_authenticated/driver/ofertas/$id")({
  head: () => ({ meta: [{ title: "Detalhes da Oferta — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: OfferDetailsPage,
});

function OfferDetailsPage() {
  const { id } = Route.useParams();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-offer-detail", id],
    queryFn: async () => {
      const { data: offer } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (!offer) return null;

      const [{ data: order }, { data: program }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", offer.order_id).maybeSingle(),
        supabase.from("freight_programs").select("*").eq("order_id", offer.order_id).maybeSingle(),
      ]);

      return { offer, order, program };
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando detalhes...</div>;
  if (!data?.offer || !data?.order) return <div className="p-8 text-center text-muted-foreground">Oferta não encontrada.</div>;

  return (
    <div className="-mx-4 -mt-6">
      <OfferDetails 
        offer={data.offer as any} 
        order={data.order as any} 
        program={data.program as any}
        now={now}
      />
    </div>
  );
}
