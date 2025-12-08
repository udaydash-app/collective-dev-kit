import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

export const useAdmin = () => {
  const [offlineSession, setOfflineSession] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for offline session
  useEffect(() => {
    const checkOfflineSession = () => {
      try {
        const offlineData = localStorage.getItem('offline_pos_session');
        if (offlineData) {
          const session = JSON.parse(offlineData);
          setOfflineSession(session);
          console.log('Found offline session:', session);
        }
      } catch (error) {
        console.error('Error reading offline session:', error);
      }
    };
    
    checkOfflineSession();
  }, []);

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    // Don't fetch if offline - use cached data
    enabled: !isOffline,
    retry: isOffline ? false : 3,
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
    retry: isOffline ? false : 3,
  });

  // If we have an offline session (either offline or no online session), use it
  if (offlineSession && (isOffline || !session)) {
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

  // If offline and no offline session, return not loading but not admin
  if (isOffline && !offlineSession) {
    return {
      isAdmin: false,
      isCashier: false,
      role: null,
      isLoading: false,
      user: null,
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
    hasOfflineSession: !!offlineSession,
    isOffline
  });

  return {
    isAdmin,
    isCashier: roleData?.role === 'cashier',
    role: roleData?.role,
    isLoading,
    user: session?.user ?? null,
  };
};
