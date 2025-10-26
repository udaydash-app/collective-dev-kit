import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAdmin = () => {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    }
  });

  const { data: roleData, isLoading } = useQuery({
    queryKey: ['userRole', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking role:', error);
        return null;
      }

      return data;
    },
    enabled: !!session?.user?.id,
  });

  return {
    isAdmin: roleData?.role === 'admin' || roleData?.role === 'cashier',
    isCashier: roleData?.role === 'cashier',
    role: roleData?.role,
    isLoading,
    user: session?.user ?? null,
  };
};
