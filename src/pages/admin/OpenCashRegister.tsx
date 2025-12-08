import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CashInDialog } from '@/components/pos/CashInDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { useLocalStores, useLocalCashSessions, useIsLocalMode } from '@/hooks/useLocalData';
import { offlineDB } from '@/lib/offlineDB';

export default function OpenCashRegister() {
  const navigate = useNavigate();
  const [showCashIn, setShowCashIn] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const isLocalMode = useIsLocalMode();

  // Fetch stores using local-aware hook
  const { data: stores } = useLocalStores();

  // Get current user/session for filtering
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    const getUser = async () => {
      if (isLocalMode) {
        // In local mode, get user from offline session
        const offlineSession = localStorage.getItem('offline_pos_session');
        if (offlineSession) {
          const session = JSON.parse(offlineSession);
          setCurrentUserId(session.pos_user_id);
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      }
    };
    getUser();
  }, [isLocalMode]);

  // Check for active sessions using local-aware hook
  const { data: allCashSessions } = useLocalCashSessions();
  
  // Filter to get only active sessions for current user
  const activeSessions = allCashSessions?.filter(
    (session: any) => session.status === 'open' && session.cashier_id === currentUserId
  ) || [];

  const handleOpenCash = async (openingCash: number) => {
    if (!selectedStore) {
      toast.error('Please select a store first');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if there's already an open session for this store
      const { data: existingSession } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('cashier_id', user.id)
        .eq('store_id', selectedStore)
        .eq('status', 'open')
        .maybeSingle();

      if (existingSession) {
        toast.error('You already have an open cash session for this store');
        return;
      }

      // Create new cash session
      const { error } = await supabase
        .from('cash_sessions')
        .insert({
          cashier_id: user.id,
          store_id: selectedStore,
          opening_cash: openingCash,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Cash register opened successfully!');
      setShowCashIn(false);
      
      // Navigate to POS
      navigate('/admin/pos');
    } catch (error: any) {
      console.error('Error opening cash register:', error);
      toast.error('Failed to open cash register');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Open Cash Register</h1>
            <p className="text-muted-foreground">Start a new cash session</p>
          </div>
        </div>

        {activeSessions && activeSessions.length > 0 && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Active Cash Sessions
              </CardTitle>
              <CardDescription>
                You have {activeSessions.length} open cash session{activeSessions.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeSessions.map((session: any) => {
                  const storeName = stores?.find((s: any) => s.id === session.store_id)?.name || session.stores?.name || 'Unknown Store';
                  return (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                    <div>
                      <p className="font-semibold">{storeName}</p>
                      <p className="text-sm text-muted-foreground">
                        Opened: {new Date(session.opened_at).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Opening Cash: {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'XAF',
                        }).format(session.opening_cash || 0)}
                      </p>
                    </div>
                    <Button
                      onClick={() => navigate('/admin/pos')}
                    >
                      Go to POS
                    </Button>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Open New Cash Session</CardTitle>
            <CardDescription>
              Select a store and enter the opening cash amount to start a new session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Store</label>
                <div className="grid gap-2">
                  {stores?.map((store) => (
                    <Button
                      key={store.id}
                      variant={selectedStore === store.id ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedStore(store.id)}
                    >
                      {store.name}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  if (!selectedStore) {
                    toast.error('Please select a store first');
                    return;
                  }
                  setShowCashIn(true);
                }}
                disabled={!selectedStore}
              >
                <DollarSign className="mr-2 h-5 w-5" />
                Open Cash Register
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Select the store where you'll be working</p>
            <p>2. Click "Open Cash Register" to enter the opening cash amount</p>
            <p>3. Count your starting cash and enter the exact amount</p>
            <p>4. You'll be redirected to the POS to start processing sales</p>
            <p className="text-primary font-medium mt-4">
              Note: You can only have one open session per store at a time
            </p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />

      <CashInDialog
        isOpen={showCashIn}
        onClose={() => setShowCashIn(false)}
        onConfirm={handleOpenCash}
      />
    </div>
  );
}
