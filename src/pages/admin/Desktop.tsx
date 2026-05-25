import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APPS, APP_GROUPS, type AppGroup } from '@/lib/appRegistry';
import { useWindowStore, windowActions } from '@/store/windowStore';
import { AppTile } from '@/components/desktop/AppTile';
import { Taskbar } from '@/components/desktop/Taskbar';
import { WindowManager } from '@/components/desktop/WindowManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, LogOut, User as UserIcon,
  ShoppingCart, Package, ShoppingBag, BookOpen, BarChart3, Megaphone, UserCog,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const GROUP_META: Record<AppGroup, { icon: LucideIcon; color: string }> = {
  'POS & Sales': { icon: ShoppingCart, color: 'from-emerald-500 to-green-600' },
  'Inventory': { icon: Package, color: 'from-violet-500 to-purple-600' },
  'Purchasing': { icon: ShoppingBag, color: 'from-pink-500 to-rose-600' },
  'Accounting': { icon: BookOpen, color: 'from-blue-600 to-indigo-700' },
  'Analytics': { icon: BarChart3, color: 'from-cyan-500 to-blue-600' },
  'Marketing': { icon: Megaphone, color: 'from-orange-500 to-red-600' },
  'Admin': { icon: UserCog, color: 'from-slate-500 to-gray-700' },
};

export default function Desktop() {
  const [query, setQuery] = useState('');
  const [openGroup, setOpenGroup] = useState<AppGroup | null>(null);
  const { windows } = useWindowStore();
  const navigate = useNavigate();

  const session = (() => {
    try {
      const raw = localStorage.getItem('offline_pos_session');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const q = query.trim().toLowerCase();

  // When searching, show matching apps directly. Otherwise show group folders.
  const searchResults = useMemo(() => {
    if (!q) return [];
    return APPS.filter(
      (a) => a.title.toLowerCase().includes(q) || a.group.toLowerCase().includes(q),
    );
  }, [q]);

  const groupApps = useMemo(() => {
    if (!openGroup) return [];
    return APPS.filter((a) => a.group === openGroup);
  }, [openGroup]);

  const handleOpen = (id: string) => {
    windowActions.openApp(id);
    setOpenGroup(null);
  };

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
        <div className="absolute inset-0 overflow-y-auto px-6 py-8 z-0">
          <div className="max-w-5xl mx-auto">
            {q ? (
              <>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-3 pl-2">
                  Results
                </h2>
                <div className="flex flex-wrap gap-2">
                  {searchResults.map((app) => (
                    <AppTile key={app.id} app={app} onOpen={handleOpen} />
                  ))}
                  {searchResults.length === 0 && (
                    <p className="text-white/70 mt-10 w-full text-center">
                      No apps match "{query}"
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {APP_GROUPS.map((g) => {
                  const meta = GROUP_META[g];
                  const Icon = meta.icon;
                  const count = APPS.filter((a) => a.group === g).length;
                  return (
                    <button
                      key={g}
                      onClick={() => setOpenGroup(g)}
                      onDoubleClick={() => setOpenGroup(g)}
                      className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 focus-visible:bg-white/15 focus:outline-none transition-colors"
                    >
                      <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${meta.color} shadow-xl flex items-center justify-center text-white group-hover:scale-105 group-active:scale-95 transition-transform relative`}>
                        <Icon className="h-10 w-10 drop-shadow" strokeWidth={2.2} />
                        <span className="absolute -top-1.5 -right-1.5 h-6 min-w-[1.5rem] px-1.5 rounded-full bg-background text-foreground text-[11px] font-semibold inline-flex items-center justify-center shadow">
                          {count}
                        </span>
                      </div>
                      <span className="text-sm text-center text-white font-medium leading-tight drop-shadow">
                        {g}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Windows layer */}
        <WindowManager />
      </div>

      {/* Taskbar */}
      <Taskbar onShowDesktop={handleShowDesktop} />

      {/* Group folder dialog */}
      <Dialog open={!!openGroup} onOpenChange={(o) => !o && setOpenGroup(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openGroup && (() => {
                const Icon = GROUP_META[openGroup].icon;
                return <Icon className="h-5 w-5" />;
              })()}
              {openGroup}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 pt-2">
            {groupApps.map((app) => (
              <AppTile key={app.id} app={app} onOpen={handleOpen} variant="panel" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}