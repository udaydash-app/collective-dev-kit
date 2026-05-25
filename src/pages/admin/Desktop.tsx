import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APPS, APP_GROUPS } from '@/lib/appRegistry';
import { useWindowStore, windowActions } from '@/store/windowStore';
import { AppTile } from '@/components/desktop/AppTile';
import { Taskbar } from '@/components/desktop/Taskbar';
import { WindowManager } from '@/components/desktop/WindowManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LogOut, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Desktop() {
  const [query, setQuery] = useState('');
  const { windows } = useWindowStore();
  const navigate = useNavigate();

  const session = (() => {
    try {
      const raw = localStorage.getItem('offline_pos_session');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APPS;
    return APPS.filter(
      (a) => a.title.toLowerCase().includes(q) || a.group.toLowerCase().includes(q),
    );
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof APPS>();
    APP_GROUPS.forEach((g) => map.set(g, []));
    filtered.forEach((a) => {
      const arr = map.get(a.group) ?? [];
      arr.push(a);
      map.set(a.group, arr);
    });
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [filtered]);

  const handleOpen = (id: string) => windowActions.openApp(id);

  const handleShowDesktop = () => {
    windows.forEach((w) => { if (!w.minimized) windowActions.minimize(w.id); });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem('offline_pos_session');
    sessionStorage.removeItem('current_pos_pin');
    windowActions.closeAll();
    toast.success('Logged out');
    navigate('/pos-login');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[linear-gradient(135deg,hsl(220_45%_12%),hsl(260_50%_18%)_50%,hsl(200_55%_22%))]">
      {/* Top bar */}
      <header className="h-12 shrink-0 px-3 flex items-center justify-between bg-background/30 backdrop-blur-xl border-b border-white/10 text-white">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="h-6 w-6 rounded bg-gradient-to-br from-emerald-400 to-cyan-500 shadow" />
          Global Market Desktop
        </div>

        <div className="relative w-72 max-w-[40vw]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps..."
            className="pl-8 h-8 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-white/80">
            <UserIcon className="h-4 w-4" />
            {session?.full_name ?? 'Staff'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white/90 hover:bg-white/15 hover:text-white"
          >
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Desktop area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Tile grid (sits behind windows) */}
        <div className="absolute inset-0 overflow-y-auto px-6 py-6 z-0">
          <div className="max-w-6xl mx-auto space-y-8">
            {groups.map(([group, items]) => (
              <section key={group}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3 pl-2">
                  {group}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {items.map((app) => (
                    <AppTile key={app.id} app={app} onOpen={handleOpen} />
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && (
              <p className="text-center text-white/70 mt-20">No apps match "{query}"</p>
            )}
          </div>
        </div>

        {/* Windows layer */}
        <WindowManager />
      </div>

      {/* Taskbar */}
      <Taskbar onShowDesktop={handleShowDesktop} />
    </div>
  );
}