import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getSupabaseConfig, setLocalSupabaseConfig, clearLocalSupabaseConfig } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Hash, Loader2, WifiOff, Database, Settings, Server } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { offlineDB } from '@/lib/offlineDB';
import { cacheEssentialData } from '@/lib/cacheData';
import { shouldUseLocalData, isLocalMode, isLocalSupabase, checkLocalSupabaseReachable } from '@/lib/localModeHelper';
import { cloudSyncService, setCloudServiceRoleKey, hasCloudServiceRoleKey } from '@/lib/cloudSyncService';
import logo from '@/assets/logo.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function POSLogin() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(shouldUseLocalData());
  const [cacheStatus, setCacheStatus] = useState<{products: number; stores: number; categories: number} | null>(null);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [cloudServiceRoleKey, setCloudServiceRoleKeyState] = useState('');
  const [currentConfig, setCurrentConfig] = useState<{url: string; anonKey: string; serviceRoleKey?: string} | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Load current server config on mount
  useEffect(() => {
    const supabaseConfig = getSupabaseConfig();
    if (supabaseConfig.isLocal) {
      // Read from localStorage to get all keys
      try {
        const localConfig = localStorage.getItem('local_supabase_config');
        if (localConfig) {
          const config = JSON.parse(localConfig);
          setCurrentConfig({ url: config.url, anonKey: config.anonKey, serviceRoleKey: config.serviceRoleKey });
          setServerUrl(config.url);
          setServerKey(config.anonKey || '');
          setServiceRoleKey(config.serviceRoleKey || '');
        }
      } catch (e) {
        setCurrentConfig({ url: supabaseConfig.url, anonKey: supabaseConfig.key });
        setServerUrl(supabaseConfig.url);
        setServerKey(supabaseConfig.key);
      }
    } else {
      setCurrentConfig(null);
    }
    
    // Load cloud service role key
    const savedCloudKey = localStorage.getItem('cloud_service_role_key');
    if (savedCloudKey) {
      setCloudServiceRoleKeyState(savedCloudKey);
    }
  }, []);

  // Check if running as installed PWA
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    console.log('Running as installed PWA:', standalone);
  }, []);

  // Initialize IndexedDB and check local Supabase reachability on component mount
  useEffect(() => {
    const initDB = async () => {
      try {
        console.log('Initializing IndexedDB for PWA...');
        await offlineDB.init();
        setDbInitialized(true);
        console.log('✓ IndexedDB initialized successfully');
        
        // Check local Supabase reachability if configured
        if (isLocalSupabase()) {
          console.log('Checking local Supabase reachability...');
          const reachable = await checkLocalSupabaseReachable();
          console.log('Local Supabase reachable:', reachable);
          setIsOffline(!reachable);
        }
      } catch (error) {
        console.error('✗ Failed to initialize IndexedDB:', error);
        toast.error('Failed to initialize offline storage. Offline mode will not work.');
      }
    };
    
    initDB();
  }, []);

  // Monitor online/offline status - also consider local LAN mode
  useEffect(() => {
    const handleOnline = () => setIsOffline(shouldUseLocalData());
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
      // Wait for DB initialization
      if (!dbInitialized) {
        console.log('Waiting for DB initialization...');
        return;
      }
      
      try {
        console.log('Checking cached data status...');
        const products = await offlineDB.getProducts();
        const stores = await offlineDB.getStores();
        const categories = await offlineDB.getCategories();
        
        console.log('Cache status:', {
          products: products.length,
          stores: stores.length,
          categories: categories.length
        });
        
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
    
    // Only start polling if DB is initialized
    if (dbInitialized) {
      const interval = setInterval(checkCache, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [dbInitialized]);

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

      // Function to attempt offline login
      const attemptOfflineLogin = async () => {
        console.log('🔴 ATTEMPTING OFFLINE LOGIN');
        
        if (!dbInitialized) {
          console.error('🔴 Database not initialized yet');
          throw new Error('Offline storage is initializing. Please wait a moment.');
        }
        
        console.log('🔴 Fetching cached POS users from IndexedDB...');
        const cachedUsers = await offlineDB.getAllPOSUsers();
        console.log(`🔴 Found ${cachedUsers.length} cached users in IndexedDB`);
        
        if (cachedUsers.length === 0) {
          console.warn('🔴 No cached users found in IndexedDB');
          throw new Error('No cached login data found. Please connect to internet and login once to enable offline mode.');
        }
        
        console.log('🔴 Cached users details:', cachedUsers.map(u => ({ 
          id: u.id,
          name: u.full_name, 
          active: u.is_active,
          hasPin: !!u.pin_hash,
          pinLength: u.pin_hash?.length
        })));
        console.log('🔴 Entered PIN:', pinValue, 'Length:', pinValue.length);
        
        const matchedUser = cachedUsers.find(u => {
          const pinMatches = u.pin_hash === pinValue;
          console.log(`🔴 Checking user: ${u.full_name}`);
          console.log(`   - PIN in DB: ${u.pin_hash} (length: ${u.pin_hash?.length})`);
          console.log(`   - PIN entered: ${pinValue} (length: ${pinValue.length})`);
          console.log(`   - Match: ${pinMatches}, Active: ${u.is_active}`);
          return pinMatches && u.is_active;
        });
        
        if (!matchedUser) {
          console.error('🔴 No matching user found for entered PIN');
          throw new Error('Invalid PIN. Please check your PIN and try again.');
        }
        
        console.log('✅ Offline login successful for:', matchedUser.full_name);
        return {
          posUserId: matchedUser.id,
          userId: matchedUser.user_id,
          fullName: matchedUser.full_name
        };
      };

      // Try offline login first if offline
      if (isOffline) {
        console.log('🔴 OFFLINE MODE DETECTED: Attempting offline login');
        console.log('🔴 Standalone mode:', isStandalone);
        console.log('🔴 DB Initialized:', dbInitialized);
        
        try {
          const offlineResult = await attemptOfflineLogin();
          posUserId = offlineResult.posUserId;
          userId = offlineResult.userId;
          fullName = offlineResult.fullName;
          
          // Store offline session
          const sessionData = {
            pos_user_id: posUserId,
            user_id: userId,
            full_name: fullName,
            timestamp: new Date().toISOString(),
            offline: true
          };
          localStorage.setItem('offline_pos_session', JSON.stringify(sessionData));
          console.log('✅ Stored offline session:', sessionData);
          
          toast.success(`Welcome back, ${fullName}! (Offline Mode)`);
          await new Promise(resolve => setTimeout(resolve, 500));
          navigate('/admin/pos');
          return;
        } catch (offlineError) {
          console.error('🔴 Offline login error:', offlineError);
          toast.error((offlineError as Error).message);
          setPin('');
          setIsLoading(false);
          return;
        }
      }

      // Online login - wrap in try-catch to detect network failures
      console.log('🟢 ONLINE MODE: Attempting to verify PIN with server');
      
      let data: VerifyPinResult[] | null = null;
      
      try {
        const result = await supabase
          .rpc('verify_pin', { input_pin: pinValue }) as { data: VerifyPinResult[] | null; error: any };
        
        if (result.error) {
          throw result.error;
        }
        
        data = result.data;
      } catch (networkError: any) {
        // Network error detected - fall back to offline login
        console.log('🔴 Network error caught during RPC call:', networkError);
        console.log('🔴 Error type:', networkError?.constructor?.name);
        console.log('🔴 Error message:', networkError?.message);
        
        const isNetworkError = 
          networkError?.message?.includes('Failed to fetch') || 
          networkError?.message?.includes('INTERNET_DISCONNECTED') ||
          networkError?.message?.includes('NetworkError') ||
          networkError?.message?.includes('Network request failed') ||
          networkError?.name === 'TypeError';
        
        if (isNetworkError) {
          console.log('🔴 Confirmed network error, attempting offline login fallback');
          toast.info('Network unavailable, attempting offline login...');
          
          try {
            const offlineResult = await attemptOfflineLogin();
            posUserId = offlineResult.posUserId;
            userId = offlineResult.userId;
            fullName = offlineResult.fullName;
            
            // Store offline session
            const sessionData = {
              pos_user_id: posUserId,
              user_id: userId,
              full_name: fullName,
              timestamp: new Date().toISOString(),
              offline: true
            };
            localStorage.setItem('offline_pos_session', JSON.stringify(sessionData));
            console.log('✅ Offline fallback successful, stored session:', sessionData);
            
            toast.success(`Welcome back, ${fullName}! (Offline Mode)`);
            await new Promise(resolve => setTimeout(resolve, 500));
            navigate('/admin/pos');
            return;
          } catch (offlineError) {
            console.error('🔴 Offline fallback failed:', offlineError);
            toast.error('Cannot connect to server and no offline data available.');
            setPin('');
            setIsLoading(false);
            return;
          }
        } else {
          // Not a network error, rethrow
          throw networkError;
        }
      }

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
      if (dbInitialized) {
        try {
          console.log('Caching user credentials for offline use...');
          await offlineDB.savePOSUsers([{
            id: posUserId,
            user_id: userId,
            full_name: fullName,
            pin_hash: pinValue,
            is_active: true,
            lastUpdated: new Date().toISOString()
          }]);
          console.log('✓ Cached credentials for offline use:', {
            id: posUserId,
            full_name: fullName,
            timestamp: new Date().toISOString()
          });
        } catch (cacheError) {
          console.error('Error caching user data:', cacheError);
          toast.warning('Login successful, but failed to cache for offline use.');
        }
      }

      // Check if using local Supabase - skip auth if so
      // Use getSupabaseConfig().isLocal which we know works (logs "Using local Supabase" at startup)
      const supabaseConfig = getSupabaseConfig();
      const usingLocalSupabase = supabaseConfig.isLocal;
      console.log('🔍 Local Supabase check:', { url: supabaseConfig.url, isLocal: supabaseConfig.isLocal, usingLocalSupabase });
      
      if (usingLocalSupabase) {
        console.log('🟡 Local Supabase detected - skipping Supabase Auth, using PIN-only auth');
        
        // Store session for local mode
        const sessionData = {
          pos_user_id: posUserId,
          user_id: userId,
          full_name: fullName,
          timestamp: new Date().toISOString(),
          local: true
        };
        localStorage.setItem('offline_pos_session', JSON.stringify(sessionData));
        console.log('✅ Stored local session:', sessionData);
        
        toast.success(`Welcome, ${fullName}!`);
        
        // Navigate immediately - sync and cache data in background
        navigate('/admin/pos');
        
        // Trigger two-way sync in background (non-blocking)
        // First pull from cloud, then push local changes
        (async () => {
          try {
            toast.info('Syncing with cloud...', { duration: 2000 });
            // Pull cloud data to local first
            await cloudSyncService.syncFromCloud();
            // Then push any local changes to cloud
            await cloudSyncService.syncToCloud();
            // Cache essential data for offline use
            await cacheEssentialData(true);
          } catch (err) {
            console.error('Background sync error:', err);
          }
        })();
        return;
      }
      
      // Cloud Supabase - use full auth flow
      const authEmail = `pos-${userData.pos_user_id}@pos.globalmarket.app`;
      const authPassword = `PIN${pinValue.padStart(6, '0')}`;
      
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (authError) {
        console.error('Auth error:', authError);
        toast.error('Login failed. Your PIN may have been recently changed. Please try again or contact an administrator.');
        setPin('');
        setIsLoading(false);
        return;
      }
      
      // Ensure role exists for existing users
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentSession.user.id)
          .maybeSingle();
        
        if (!existingRole) {
          console.log('No role found, creating cashier role for existing user');
          await supabase
            .from('user_roles')
            .insert({
              user_id: currentSession.user.id,
              role: 'cashier'
            });
        }
      }

      const { data: { session: freshSession } } = await supabase.auth.getSession();
      queryClient.setQueryData(['session'], freshSession);
      
      if (freshSession?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', freshSession.user.id)
          .maybeSingle();
        queryClient.setQueryData(['userRole', freshSession.user.id], roleData);
      }
      
      toast.success(`Welcome, ${userData.full_name}!`);
      
      if (navigator.onLine) {
        toast.loading('Preparing data for offline use...', { id: 'cache-data' });
        try {
          await cacheEssentialData();
          toast.success('Data cached successfully!', { id: 'cache-data' });
        } catch (cacheError) {
          console.error('Error caching data:', cacheError);
          toast.dismiss('cache-data');
        }
      }
      
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

  const handleSaveServerConfig = () => {
    // Save cloud service role key first (doesn't require reload)
    if (cloudServiceRoleKey.trim()) {
      setCloudServiceRoleKey(cloudServiceRoleKey.trim());
      toast.success('Cloud sync key saved');
    }
    
    // If local server config provided, save and reload
    if (serverUrl.trim()) {
      if (!serverKey.trim() && !serviceRoleKey.trim()) {
        toast.error('Please enter at least the Service Role Key (recommended) or Anon Key for local server');
        return;
      }
      setLocalSupabaseConfig(serverUrl.trim(), serverKey.trim(), serviceRoleKey.trim() || undefined);
      // Page will reload automatically
    } else if (cloudServiceRoleKey.trim()) {
      // Only cloud key was updated, close dialog
      setShowServerConfig(false);
    } else {
      toast.error('Please enter either local server URL or cloud sync key');
    }
  };

  const handleClearServerConfig = () => {
    clearLocalSupabaseConfig();
    // Page will reload automatically
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center mx-auto -mt-12 -mb-20">
            <img src={logo} alt="Global Market" className="h-64 w-64 object-contain" />
          </div>
          <CardTitle className="text-3xl">POS System</CardTitle>
          <CardDescription>
            Enter your PIN to access the Point of Sale
            {isStandalone && (
              <span className="block mt-2 text-primary font-semibold">
                📱 Running as Installed App
              </span>
            )}
            {isOffline && (
              <span className="block mt-2 text-amber-600 font-semibold">
                ⚠️ Offline Mode {!dbInitialized && '- Initializing...'}
              </span>
            )}
            {!dbInitialized && !isOffline && (
              <span className="block mt-2 text-muted-foreground text-sm">
                Preparing offline mode...
              </span>
            )}
          </CardDescription>
          
          {/* Server Config Indicator */}
          {currentConfig && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-green-600">
              <Server className="h-4 w-4" />
              <span>Local Server: {currentConfig.url}</span>
            </div>
          )}
          
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

          {/* Server Config Button - Always visible */}
          <div className="pt-4 mt-4 border-t-2 border-primary">
            <Button
              variant="default"
              size="lg"
              onClick={() => setShowServerConfig(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Server className="h-5 w-5 mr-2" />
              Configure Local Server
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Server Configuration Dialog */}
      <Dialog open={showServerConfig} onOpenChange={setShowServerConfig}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Local Server Configuration</DialogTitle>
            <DialogDescription>
              Configure a local Supabase server for LAN/offline operation.
              Leave empty to use the cloud server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                placeholder="http://192.168.1.11:8000"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Example: http://192.168.1.11:8000 (your local Supabase URL)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceRoleKey" className="text-primary font-semibold">Service Role Key (Recommended)</Label>
              <Input
                id="serviceRoleKey"
                placeholder="eyJhbGciOiJIUzI1NiIs... (service_role)"
                value={serviceRoleKey}
                onChange={(e) => setServiceRoleKey(e.target.value)}
              />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Required to bypass RLS. Find service_role key in your kong.yml or API settings.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serverKey">Anon Key (Optional)</Label>
              <Input
                id="serverKey"
                placeholder="eyJhbGciOiJIUzI1NiIs... (anon)"
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional fallback. Service Role Key is preferred for local deployments.
              </p>
            </div>
            
            {/* Cloud Sync Key Section */}
            <div className="pt-4 mt-4 border-t border-dashed">
              <div className="space-y-2">
                <Label htmlFor="cloudServiceRoleKey" className="text-blue-600 dark:text-blue-400 font-semibold">
                  Cloud Service Role Key (For Sync)
                </Label>
                <Input
                  id="cloudServiceRoleKey"
                  placeholder="eyJhbGciOiJIUzI1NiIs... (cloud service_role)"
                  value={cloudServiceRoleKey}
                  onChange={(e) => setCloudServiceRoleKeyState(e.target.value)}
                />
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Required to sync data from cloud to local. Get from cloud Supabase Dashboard → Settings → API → service_role key.
                </p>
                {hasCloudServiceRoleKey() && (
                  <p className="text-xs text-green-600 dark:text-green-400">✓ Cloud sync key configured</p>
                )}
              </div>
            </div>
            
            {currentConfig && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Currently connected to: {currentConfig.url}
                </p>
                {currentConfig.serviceRoleKey ? (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Using Service Role Key (RLS bypassed)</p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Using Anon Key (RLS may block data)</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            {currentConfig && (
              <Button variant="destructive" onClick={handleClearServerConfig}>
                Use Cloud Server
              </Button>
            )}
            <Button onClick={handleSaveServerConfig}>
              Save & Reload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
