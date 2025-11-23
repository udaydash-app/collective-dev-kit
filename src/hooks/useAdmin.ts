import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Check for offline session synchronously
const getOfflineSession = () => {
  try {
    const offlineData = localStorage.getItem('offline_pos_session');
    if (offlineData) {
      const session = JSON.parse(offlineData);
      console.log('Found offline session:', session);
      return session;
    }
  } catch (error) {
    console.error('Error reading offline session:', error);
  }
  return null;
};

export const useAdmin = () => {
  const offlineSession = getOfflineSession();

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
  });

  const { data: roleData, isLoading: isRoleLoading } = useQuery({
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

  // If we have an offline session, use it
  if (offlineSession && !session) {
    console.log('Using offline session for authentication');
    return {
      isAdmin: true, // Offline POS users are always cashiers/admins
      isCashier: true,
      role: 'cashier',
      isLoading: false,
      user: {
        id: offlineSession.pos_user_id,
        email: `pos-${offlineSession.pos_user_id}@pos.globalmarket.app`,
        app_metadata: {},
        user_metadata: { full_name: offlineSession.full_name },
        aud: 'authenticated',
        created_at: offlineSession.timestamp
      } as any,
    };
  }

  const isAdmin = roleData?.role === 'admin' || roleData?.role === 'cashier';
  const isLoading = isSessionLoading || (isRoleLoading && !!session?.user?.id);

  console.log('useAdmin Debug:', {
    userId: session?.user?.id,
    roleData,
    isRoleLoading,
    isSessionLoading,
    isAdmin,
    isLoading,
    hasSession: !!session,
    hasUser: !!session?.user,
    hasOfflineSession: !!offlineSession
  });

  return {
    isAdmin,
    isCashier: roleData?.role === 'cashier',
    role: roleData?.role,
    isLoading,
    user: session?.user ?? null,
  };
};
