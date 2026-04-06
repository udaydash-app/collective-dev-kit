import { useState } from 'react';
import { Radio, Mic, Volume2, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWalkieTalkie } from '@/hooks/useWalkieTalkie';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

export const WalkieTalkie = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    isRecording,
    isPlaying,
    lastMessage,
    deviceName,
    setDeviceName,
    startRecording,
    stopRecording,
  } = useWalkieTalkie();

  // Only show on admin/POS pages
  const isAdminPage = location.pathname.startsWith('/admin') || location.pathname === '/pos-login';
  if (!isAdminPage) return null;

  return (
    <>
      {/* Floating walkie-talkie button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 left-6 h-14 w-14 rounded-full shadow-lg z-50",
          isPlaying && "animate-pulse ring-2 ring-accent"
        )}
        size="icon"
        variant={isOpen ? "secondary" : "default"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Radio className="h-6 w-6" />}
        {isPlaying && !isOpen && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent rounded-full animate-pulse" />
        )}
      </Button>

      {/* Walkie-talkie panel */}
      {isOpen && (
        <div className="fixed bottom-24 left-6 w-72 bg-background border border-border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border bg-primary text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              <span className="font-semibold text-sm">Walkie-Talkie</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-primary-foreground hover:bg-primary/80"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Settings */}
          {showSettings && (
            <div className="p-3 border-b border-border bg-muted/50 space-y-2">
              <Label className="text-xs">Device Name</Label>
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Cashier 1"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Status */}
          <div className="p-3 space-y-3">
            <div className="text-center text-xs text-muted-foreground">
              {deviceName}
            </div>

            {/* Last received message */}
            {lastMessage && (
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-md text-xs",
                isPlaying ? "bg-accent/20 text-accent-foreground" : "bg-muted"
              )}>
                <Volume2 className={cn("h-3.5 w-3.5 shrink-0", isPlaying && "animate-pulse")} />
                <span className="truncate">
                  {isPlaying ? `Playing from ${lastMessage.senderName}...` : `Last: ${lastMessage.senderName}`}
                </span>
              </div>
            )}

            {/* Push-to-talk button */}
            <Button
              className={cn(
                "w-full h-24 rounded-xl text-lg font-bold transition-all select-none",
                isRecording
                  ? "bg-destructive hover:bg-destructive text-destructive-foreground scale-95 ring-4 ring-destructive/30"
                  : "bg-primary hover:bg-primary/90"
              )}
              onPointerDown={(e) => {
                e.preventDefault();
                startRecording();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                stopRecording();
              }}
              onPointerLeave={() => {
                if (isRecording) stopRecording();
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center gap-2">
                <Mic className={cn("h-8 w-8", isRecording && "animate-pulse")} />
                <span className="text-sm">
                  {isRecording ? 'RELEASE TO SEND' : 'HOLD TO TALK'}
                </span>
              </div>
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Press & hold to record, release to send to all devices
            </p>
          </div>
        </div>
      )}
    </>
  );
};
