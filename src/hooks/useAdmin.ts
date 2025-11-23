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

  console.log('🔍 useAdmin Debug - Offline Check:', 
    'hasOfflineSession:', !!offlineSession,
    'isOffline:', isOffline,
    'navigatorOnline:', navigator.onLine,
    'offlineSessionData:', JSON.stringify(offlineSession)
  );

  // If we have an offline session, use it immediately without any server queries
  if (offlineSession) {
    console.log('✅ Using offline session for authentication - skipping all server queries');
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

  // Only reach here if no offline session exists
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    enabled: !isOffline,
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
    enabled: !!session?.user?.id && !isOffline,
  });

  const isAdmin = roleData?.role === 'admin' || roleData?.role === 'cashier';
  const isLoading = isSessionLoading || (isRoleLoading && !!session?.user?.id) || (!!session?.user?.id && roleData === undefined && !isOffline);

  console.log('🔍 useAdmin Debug (online mode):',
    'userId:', session?.user?.id,
    'userEmail:', session?.user?.email,
    'roleData:', JSON.stringify(roleData),
    'roleDataRole:', roleData?.role,
    'isRoleLoading:', isRoleLoading,
    'isSessionLoading:', isSessionLoading,
    'isAdmin:', isAdmin,
    'isLoading:', isLoading,
    'hasSession:', !!session,
    'hasUser:', !!session?.user,
    'navigatorOnline:', navigator.onLine
  );

  return {
    isAdmin,
    isCashier: roleData?.role === 'cashier',
    role: roleData?.role,
    isLoading,
    user: session?.user ?? null,
  };
};
