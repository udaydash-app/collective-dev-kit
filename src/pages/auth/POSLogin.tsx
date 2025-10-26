import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Hash } from 'lucide-react';

export default function POSLogin() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
      // Verify PIN using the database function
      const { data, error } = await supabase
        .rpc('verify_pin', { input_pin: pinValue }) as { data: VerifyPinResult[] | null; error: any };

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Invalid PIN. Please try again.');
        setPin('');
        return;
      }

      const userData = data[0];
      
      // Use pos_user_id if user_id is null (first time login)
      const emailIdentifier = userData.user_id || userData.pos_user_id;
      const authEmail = `pos-${emailIdentifier}@globalmarket.local`;
      
      // Try to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: pinValue,
      });

      if (authError) {
        // If user doesn't exist in auth, create them
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: pinValue,
          options: {
            data: {
              full_name: userData.full_name,
            }
          }
        });

        if (signUpError) throw signUpError;

        // Update pos_users with the new auth user_id
        if (signUpData.user && !userData.user_id) {
          await supabase
            .from('pos_users')
            .update({ user_id: signUpData.user.id })
            .eq('id', userData.pos_user_id);
        }

        // Try signing in again
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: pinValue,
        });

        if (retryError) throw retryError;
      }

      toast.success(`Welcome, ${userData.full_name}!`);
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
          <CardDescription>Enter your PIN to access the Point of Sale</CardDescription>
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

          <p className="text-center text-sm text-muted-foreground mt-6">
            Default PIN for testing: <span className="font-mono font-bold">1234</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
