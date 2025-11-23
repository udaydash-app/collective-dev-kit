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
  const isOffline = !navigator.onLine;

  console.log('🔍 useAdmin Debug:', {
    hasOfflineSession: !!offlineSession,
    isOffline,
    navigatorOnline: navigator.onLine,
    offlineSessionData: offlineSession
  });

  // If we have an offline session (regardless of online status), prioritize it when there's no Supabase session
  if (offlineSession) {
    console.log('✅ Using offline session for authentication');
    return {
      isAdmin: true,
      isCashier: true,
      role: 'cashier' as const,
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

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    enabled: !isOffline, // Don't try to fetch session when offline
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
    enabled: !!session?.user?.id && !isOffline, // Don't try to fetch role when offline
  });

  // If we have an offline session, use it
  if (offlineSession && !session) {
    console.log('Using offline session for authentication');
    return {
      isAdmin: true, // Offline POS users are always cashiers/admins
      isCashier: true,
      role: 'cashier' as const,
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

  // FALLBACK: Check for offline session if no role data found
  const hasValidOfflineSession = offlineSession && (!session || roleData === null);
  const isAdminFromRole = roleData?.role === 'admin' || roleData?.role === 'cashier';
  const isAdmin = isAdminFromRole || hasValidOfflineSession;
  const isLoading = isSessionLoading || (isRoleLoading && !!session?.user?.id);

  console.log('useAdmin Debug:', {
    userId: session?.user?.id,
    roleData,
    isRoleLoading,
    isSessionLoading,
    isAdmin,
    isAdminFromRole,
    hasValidOfflineSession,
    isLoading,
    hasSession: !!session,
    hasUser: !!session?.user,
    hasOfflineSession: !!offlineSession,
    offlineSessionData: offlineSession
  });

  // If we have offline session and no valid online role, use offline session
  if (hasValidOfflineSession) {
    console.log('✅ FALLBACK: Using offline session for authentication');
    return {
      isAdmin: true,
      isCashier: true,
      role: 'cashier' as const,
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

  return {
    isAdmin,
    isCashier: roleData?.role === 'cashier',
    role: roleData?.role,
    isLoading,
    user: session?.user ?? null,
  };
};
