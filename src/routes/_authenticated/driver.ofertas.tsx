import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OfferCard } from "@/components/driver/panels";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/ofertas")({
  head: () => ({ meta: [{ title: "Ofertas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverOffers,
});

function DriverOffers() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-offers-all", userId],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("driver_id", userId)
        .in("status", ["pending", "negotiating"])
        .order("created_at", { ascending: false });
      if (!offers?.length) return [];
      const ids = offers.map((o) => o.order_id);
      const [{ data: orders }, { data: programs }] = await Promise.all([
        supabase.from("orders").select("*").in("id", ids),
        supabase.from("freight_programs").select("*").in("order_id", ids),
      ]);
      return offers.map((o) => ({
        offer: o,
        order: orders?.find((x) => x.id === o.order_id),
        program: programs?.find((p) => p.order_id === o.order_id),
      }));
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`driver-offers-page-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_offers", filter: `driver_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["driver-offers-all", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const items = q.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ofertas de fretes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aceite, negocie ou recuse propostas em tempo real.</p>
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Package className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma oferta aguardando sua resposta.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(({ offer, order, program }) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              order={order}
              program={program}
              userId={userId}
              onChanged={() => q.refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
