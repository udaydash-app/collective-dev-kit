import { useEffect, useState } from 'react';
import { useWindowStore, windowActions } from '@/store/windowStore';
import { findAppById } from '@/lib/appRegistry';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';

interface Props {
  onShowDesktop: () => void;
}

export function Taskbar({ onShowDesktop }: Props) {
  const { windows, topZ } = useWindowStore();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  return (
    <div className="h-12 shrink-0 bg-background/80 backdrop-blur-xl border-t border-border flex items-center px-2 gap-1">
      <button
        onClick={onShowDesktop}
        className="h-9 px-3 rounded-md inline-flex items-center gap-2 text-sm font-medium hover:bg-accent transition-colors"
        aria-label="Show desktop"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Desktop</span>
      </button>

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {windows.map((w) => {
          const app = findAppById(w.appId);
          if (!app) return null;
          const Icon = app.icon;
          const isFocused = !w.minimized && w.zIndex === topZ;
          return (
            <button
              key={w.id}
              onClick={() => {
                if (w.minimized) windowActions.restore(w.id);
                else if (isFocused) windowActions.minimize(w.id);
                else windowActions.focus(w.id);
              }}
              className={cn(
                'h-9 px-3 max-w-[180px] rounded-md inline-flex items-center gap-2 text-sm transition-colors shrink-0',
                isFocused
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : w.minimized
                  ? 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  : 'bg-accent/50 hover:bg-accent',
              )}
              title={app.title}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{app.title}</span>
            </button>
          );
        })}
      </div>

      <div className="px-3 py-1 text-right text-xs text-muted-foreground leading-tight border-l border-border ml-1">
        <div className="font-medium text-foreground tabular-nums">{time}</div>
        <div className="tabular-nums">{date}</div>
      </div>
    </div>
  );
}