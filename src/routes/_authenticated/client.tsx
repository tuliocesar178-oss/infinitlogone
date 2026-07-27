import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    
    // Check if user is a client
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const isClient = roles?.some(r => r.role === 'client');
    const isAdmin = roles?.some(r => r.role === 'admin');
    
    if (!isClient && !isAdmin) {
      // If not client or admin, they might be driver or ops
      // For now, let's just let them through if they are authenticated, 
      // but ideally we redirect to their specific portal.
    }
  },
  component: ClientLayout,
});

function ClientLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
