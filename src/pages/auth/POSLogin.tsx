import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Hash, Loader2, WifiOff, Database } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDB } from '@/lib/offlineDB';
import { cacheEssentialData } from '@/lib/cacheData';

export default function POSLogin() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cacheStatus, setCacheStatus] = useState<{products: number; stores: number; categories: number} | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Check cached data status
  useEffect(() => {
    const checkCache = async () => {
      try {
        const products = await offlineDB.getProducts();
        const stores = await offlineDB.getStores();
        const categories = await offlineDB.getCategories();
        
        setCacheStatus({
          products: products.length,
          stores: stores.length,
          categories: categories.length
        });
      } catch (error) {
        console.error('Error checking cache:', error);
      }
    };

    checkCache();
    const interval = setInterval(checkCache, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  interface VerifyPinResult {
    pos_user_id: string;
    user_id: string | null;
    full_name: string;
  }

  const handlePinInput = (value: string) => {
    // Only allow digits and max 6 characters
    if (/^\d*$/.test(value) && value.length <= 6) {
      setPin(value);
      
      // Auto-submit when PIN is 4-6 digits
      if (value.length >= 4 && value.length <= 6) {
        handleLogin(value);
      }
    }
  };

  const handleLogin = async (pinValue: string = pin) => {
    if (pinValue.length < 4) {
      toast.error('Please enter a valid PIN (4-6 digits)');
      return;
    }

    setIsLoading(true);

    try {
      let posUserId: string | null = null;
      let userId: string | null = null;
      let fullName: string = '';

      // Try offline login first if offline
      if (isOffline) {
        console.log('Offline mode: Checking cached credentials');
        
        // Import offlineDB
        const { offlineDB } = await import('@/lib/offlineDB');
        await offlineDB.init();
        
        // Get all cached users and verify PIN
        const cachedUsers = await offlineDB.getAllPOSUsers();
        console.log('Found cached users:', cachedUsers.length);
        console.log('Cached users:', cachedUsers);
        console.log('Entered PIN:', pinValue);
        
        // Simple PIN matching (in production, you'd want proper hashing)
        const matchedUser = cachedUsers.find(u => {
          console.log('Checking user:', u.full_name, 'PIN:', u.pin_hash, 'Active:', u.is_active);
          return u.pin_hash === pinValue && u.is_active;
        });
        console.log('Matched user:', matchedUser);

        if (matchedUser) {
          posUserId = matchedUser.id;
          userId = matchedUser.user_id;
          fullName = matchedUser.full_name;
          console.log('Offline login successful');
          
          // Store offline session
          localStorage.setItem('offline_pos_session', JSON.stringify({
            pos_user_id: posUserId,
            user_id: userId,
            full_name: fullName,
            timestamp: new Date().toISOString()
          }));
          
          toast.success(`Welcome back, ${fullName} (Offline Mode)`);
          await new Promise(resolve => setTimeout(resolve, 300));
          navigate('/admin/pos');
          return;
        } else {
          toast.error('Invalid PIN or user not found in offline cache. Please connect to internet to login.');
          setPin('');
          setIsLoading(false);
          return;
        }
      }

      // Online login
      console.log('Online mode: Verifying PIN with server');
      
      const { data, error } = await supabase
        .rpc('verify_pin', { input_pin: pinValue }) as { data: VerifyPinResult[] | null; error: any };

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Invalid PIN. Please try again.');
        setPin('');
        return;
      }

      const userData = data[0];
      posUserId = userData.pos_user_id;
      userId = userData.user_id;
      fullName = userData.full_name;

      // Cache this user's credentials for offline use
      try {
        const { offlineDB } = await import('@/lib/offlineDB');
        await offlineDB.init();
        
        // Store the plain PIN for offline verification (less secure but necessary for offline mode)
        await offlineDB.savePOSUsers([{
          id: posUserId,
          user_id: userId,
          full_name: fullName,
          pin_hash: pinValue, // Store the plain PIN that was successfully verified
          is_active: true,
          lastUpdated: new Date().toISOString()
        }]);
        console.log('Cached credentials for offline use:', {
          id: posUserId,
          full_name: fullName,
          pin_cached: pinValue,
          timestamp: new Date().toISOString()
        });
      } catch (cacheError) {
        console.error('Error caching user data:', cacheError);
        // Don't fail login if caching fails
      }
      
      // Use pos_user_id if user_id is null (first time login)
      const emailIdentifier = userData.user_id || userData.pos_user_id;
      const authEmail = `pos-${emailIdentifier}@pos.globalmarket.app`;
      
      // Create a password that meets Supabase requirements (min 6 chars)
      // Pad PIN to ensure it's at least 6 characters
      const authPassword = `PIN${pinValue.padStart(6, '0')}`;
      
      // Try to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (authError) {
        // If user doesn't exist in auth, create them
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              full_name: userData.full_name,
            },
            emailRedirectTo: `${window.location.origin}/admin/pos`
          }
        });

        if (signUpError) {
          console.error('Signup error:', signUpError);
          throw signUpError;
        }

        // Update pos_users with the new auth user_id
        if (signUpData.user && !userData.user_id) {
          const { error: updateError } = await supabase
            .from('pos_users')
            .update({ user_id: signUpData.user.id })
            .eq('id', userData.pos_user_id);
          
          if (updateError) {
            console.error('Error updating pos_users:', updateError);
          }
          
          // Assign cashier role to the new user
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: signUpData.user.id,
              role: 'cashier'
            });
          
          if (roleError) {
            console.error('Error inserting role:', roleError);
            throw new Error('Failed to assign role: ' + roleError.message);
          }
          
          console.log('Successfully assigned cashier role to user:', signUpData.user.id);
        }

        // Try signing in again
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        if (retryError) throw retryError;
      }
      
      // Ensure role exists for existing users (in case they were created before role assignment was added)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentSession.user.id)
          .maybeSingle();
        
        if (!existingRole) {
          console.log('No role found, creating cashier role for existing user');
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: currentSession.user.id,
              role: 'cashier'
            });
          
          if (roleError) {
            console.error('Error inserting role for existing user:', roleError);
          }
        }
      }

      // Get the fresh session and manually update the query cache
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      
      // Manually set the session in the query cache for immediate availability
      queryClient.setQueryData(['session'], freshSession);
      
      // Fetch and set the role data
      if (freshSession?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', freshSession.user.id)
          .maybeSingle();
        
        // Set the role data in cache
        queryClient.setQueryData(['userRole', freshSession.user.id], roleData);
      }
      
      toast.success(`Welcome, ${userData.full_name}!`);
      
      // If online, cache essential data for offline use
      if (navigator.onLine) {
        toast.loading('Preparing data for offline use...', { id: 'cache-data' });
        
        try {
          await cacheEssentialData();
          toast.success('Data cached successfully!', { id: 'cache-data' });
        } catch (cacheError) {
          console.error('Error caching data:', cacheError);
          toast.dismiss('cache-data');
          // Don't fail login if caching fails
        }
      }
      
      // Wait a moment for auth state to fully propagate before navigating
      await new Promise(resolve => setTimeout(resolve, 300));
      navigate('/admin/pos');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length >= 4) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Store className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-3xl">POS System</CardTitle>
          <CardDescription>
            Enter your PIN to access the Point of Sale
            {isOffline && (
              <span className="block mt-2 text-amber-600 font-semibold">
                ⚠️ Offline Mode - Using cached credentials
              </span>
            )}
          </CardDescription>
          
          {/* Cache Status Indicators - Only show when offline */}
          {cacheStatus && isOffline && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {cacheStatus.products > 0 && cacheStatus.stores > 0 && cacheStatus.categories > 0 ? (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                  <Database className="h-4 w-4" />
                  <span>Offline: {cacheStatus.products} products available</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
                  <WifiOff className="h-4 w-4" />
                  <span>No offline data - Login online first to enable offline mode</span>
                </div>
              )}
            </div>
          )}
          
          {/* Show online status when online */}
          {!isOffline && cacheStatus && cacheStatus.products > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>{cacheStatus.products} products cached for offline use</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter 4-6 digit PIN"
                value={pin}
                onChange={(e) => handlePinInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 text-center text-2xl tracking-widest"
                maxLength={6}
                autoFocus
                disabled={isLoading}
              />
            </div>
            
            {/* PIN Dots Display */}
            <div className="flex justify-center gap-3 py-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    i <= pin.length
                      ? 'bg-primary scale-110'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                variant="outline"
                size="lg"
                onClick={() => handlePinInput(pin + num)}
                disabled={isLoading || pin.length >= 6}
                className="h-16 text-xl font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              onClick={() => setPin(pin.slice(0, -1))}
              disabled={isLoading || pin.length === 0}
              className="h-16 text-xl font-semibold"
            >
              ← Clear
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handlePinInput(pin + '0')}
              disabled={isLoading || pin.length >= 6}
              className="h-16 text-xl font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
            >
              0
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => handleLogin()}
              disabled={isLoading || pin.length < 4}
              className="h-16 text-xl font-semibold shadow-glow"
            >
              Enter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
