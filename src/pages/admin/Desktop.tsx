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
  Calculator as CalculatorIcon, UtensilsCrossed,
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
  'Restaurant': { icon: UtensilsCrossed, color: 'from-orange-500 to-red-600' },
  'External': { icon: BookOpen, color: 'from-emerald-600 to-teal-700' },
};

export default function Desktop() {
  const [query, setQuery] = useState('');
  const [openGroup, setOpenGroup] = useState<AppGroup | null>(null);
  const [pinPromptFor, setPinPromptFor] = useState<AppGroup | null>(null);
  const [pinInput, setPinInput] = useState('');
  const { windows } = useWindowStore();
  const navigate = useNavigate();

  // Hide the desktop top bar when any app window is open (not minimized),
  // so the active "page" gets full focus.
  const hasOpenWindow = windows.some((w) => !w.minimized);

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

  const EXTERNAL_PIN = '1111';
  const isExternalUnlocked = () => sessionStorage.getItem('external_group_unlocked') === '1';

  const requestOpenGroup = (g: AppGroup) => {
    if (g === 'External' && !isExternalUnlocked()) {
      setPinInput('');
      setPinPromptFor(g);
      return;
    }
    setOpenGroup(g);
  };

  const submitPin = () => {
    if (pinInput === EXTERNAL_PIN) {
      sessionStorage.setItem('external_group_unlocked', '1');
      const g = pinPromptFor;
      setPinPromptFor(null);
      setPinInput('');
      if (g) setOpenGroup(g);
    } else {
      toast.error('Incorrect PIN');
      setPinInput('');
    }
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[linear-gradient(135deg,hsl(210_40%_96%),hsl(220_30%_92%)_50%,hsl(200_40%_94%))]">
      {/* Top bar — hidden when a window is open */}
      {!hasOpenWindow && (
      <header className="h-12 shrink-0 px-3 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-slate-200 text-slate-800">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="h-6 w-6 rounded bg-gradient-to-br from-emerald-400 to-cyan-500 shadow" />
          Global Market Desktop
        </div>

        <div className="relative w-72 max-w-[40vw]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps..."
            className="pl-8 h-8 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-700">
            <UserIcon className="h-4 w-4" />
            {session?.full_name ?? 'Staff'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>
      )}

      {/* Desktop area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Tile grid (sits behind windows) */}
        <div className="absolute inset-0 overflow-auto z-0 flex items-center justify-center p-6">
          <div className="inline-block rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
            {q ? (
              <>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 pl-2">
                  Results
                </h2>
                <div className="flex flex-wrap gap-2">
                  {searchResults.map((app) => (
                    <AppTile key={app.id} app={app} onOpen={handleOpen} />
                  ))}
                  {searchResults.length === 0 && (
                    <p className="text-slate-500 mt-10 w-full text-center">
                      No apps match "{query}"
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-4 gap-6 place-items-center">
                {APP_GROUPS.map((g) => {
                  const meta = GROUP_META[g];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={g}
                      onClick={() => requestOpenGroup(g)}
                      onDoubleClick={() => requestOpenGroup(g)}
                      className="group flex flex-col items-center gap-3 p-3 rounded-xl hover:bg-slate-100 focus-visible:bg-slate-200 focus:outline-none transition-colors w-[120px]"
                    >
                      <div className={`h-28 w-28 rounded-3xl bg-gradient-to-br ${meta.color} shadow-xl flex items-center justify-center text-white group-hover:scale-105 group-active:scale-95 transition-transform`}>
                        <Icon className="h-14 w-14 drop-shadow" strokeWidth={2.2} />
                      </div>
                      <span className="text-base text-center text-slate-800 font-medium leading-tight">
                        {g}
                      </span>
                    </button>
                  );
                })}
                {/* Standalone Calculator tile, placed right after Admin */}
                <button
                  onClick={() => handleOpen('calculator')}
                  onDoubleClick={() => handleOpen('calculator')}
                  className="group flex flex-col items-center gap-3 p-3 rounded-xl hover:bg-slate-100 focus-visible:bg-slate-200 focus:outline-none transition-colors w-[120px]"
                >
                  <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-zinc-500 to-slate-700 shadow-xl flex items-center justify-center text-white group-hover:scale-105 group-active:scale-95 transition-transform">
                    <CalculatorIcon className="h-14 w-14 drop-shadow" strokeWidth={2.2} />
                  </div>
                  <span className="text-base text-center text-slate-800 font-medium leading-tight">
                    Calculator
                  </span>
                </button>
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

      {/* External PIN prompt */}
      <Dialog open={!!pinPromptFor} onOpenChange={(o) => { if (!o) { setPinPromptFor(null); setPinInput(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter PIN to unlock External</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPin(); }}
              placeholder="••••"
              maxLength={8}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setPinPromptFor(null); setPinInput(''); }}>Cancel</Button>
              <Button onClick={submitPin}>Unlock</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}