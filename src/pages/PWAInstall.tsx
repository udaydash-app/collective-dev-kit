/**
 * PWA Installation page with instructions and prompt
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Monitor, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PWAInstall() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Install Global Market POS</CardTitle>
          <CardDescription>
            Install our app for the best offline experience
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <p className="text-lg font-semibold">App is already installed!</p>
              <Button onClick={() => navigate('/pos-login')} className="w-full">
                Go to POS Login
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Features:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <span>Work completely offline - no internet required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <span>Automatic sync when connection is restored</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <span>Install on desktop and mobile devices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <span>Fast, reliable, and secure</span>
                  </li>
                </ul>
              </div>

              {isIOS ? (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-base">iOS Installation Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>1. Tap the Share button in Safari</p>
                    <p>2. Scroll down and tap "Add to Home Screen"</p>
                    <p>3. Tap "Add" to confirm</p>
                  </CardContent>
                </Card>
              ) : deferredPrompt ? (
                <Button 
                  onClick={handleInstallClick} 
                  className="w-full"
                  size="lg"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Install App
                </Button>
              ) : (
                <Card className="bg-amber-50 border-amber-200">
                  <CardHeader>
                    <CardTitle className="text-base">Desktop Installation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Look for the install icon in your browser's address bar
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/pos-login')} 
                  className="w-full"
                >
                  Continue without Installing
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
