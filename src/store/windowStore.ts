import { useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';

export interface WindowState {
  id: string;            // unique window id
  appId: string;         // appRegistry id
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  // saved geometry to restore from maximized
  prev?: { x: number; y: number; width: number; height: number };
}

export interface MinimizedDialogEntry {
  id: string;
  title: string;
  icon?: ComponentType<{ className?: string }>;
  onRestore: () => void;
  onClose: () => void;
}

const STORAGE_KEY = 'desktop_windows_v1';

interface StoreState {
  windows: WindowState[];
  topZ: number;
  minimizedDialogs: MinimizedDialogEntry[];
}

const load = (): StoreState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.windows)) return { ...parsed, minimizedDialogs: [] };
    }
  } catch {}
  return { windows: [], topZ: 10, minimizedDialogs: [] };
};

let state: StoreState = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    const { minimizedDialogs: _omit, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {}
};

const set = (updater: (s: StoreState) => StoreState) => {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

const getSnapshot = () => state;

export const useWindowStore = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const cascadeOffset = (count: number) => ({
  x: 60 + (count % 8) * 32,
  y: 50 + (count % 8) * 32,
});

const defaultSize = () => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    width: Math.min(1100, Math.max(720, vw - 200)),
    height: Math.min(720, Math.max(480, vh - 200)),
  };
};

export const windowActions = {
  openApp(appId: string) {
    set((s) => {
      const topZ = s.topZ + 1;
      const size = defaultSize();
      const pos = cascadeOffset(s.windows.length);
      const newWin: WindowState = {
        id: `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        appId,
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        zIndex: topZ,
        minimized: false,
        maximized: true,
      };
      return { ...s, topZ, windows: [...s.windows, newWin] };
    });
  },
  close(id: string) {
    set((s) => ({ ...s, windows: s.windows.filter((w) => w.id !== id) }));
  },
  minimize(id: string) {
    set((s) => ({
      ...s,
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
    }));
  },
  restore(id: string) {
    set((s) => {
      const topZ = s.topZ + 1;
      return {
        ...s,
        topZ,
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, minimized: false, zIndex: topZ } : w,
        ),
      };
    });
  },
  toggleMaximize(id: string) {
    set((s) => ({
      ...s,
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized && w.prev) {
          return { ...w, maximized: false, ...w.prev, prev: undefined };
        }
        return {
          ...w,
          maximized: true,
          prev: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      }),
    }));
  },
  focus(id: string) {
    set((s) => {
      const w = s.windows.find((x) => x.id === id);
      if (!w || w.zIndex === s.topZ) return s;
      const topZ = s.topZ + 1;
      return {
        ...s,
        topZ,
        windows: s.windows.map((x) => (x.id === id ? { ...x, zIndex: topZ } : x)),
      };
    });
  },
  move(id: string, x: number, y: number) {
    set((s) => ({
      ...s,
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    }));
  },
  resize(id: string, width: number, height: number, x?: number, y?: number) {
    set((s) => ({
      ...s,
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, width, height, x: x ?? w.x, y: y ?? w.y }
          : w,
      ),
    }));
  },
  closeAll() {
    set((s) => ({ windows: [], topZ: 10, minimizedDialogs: s.minimizedDialogs }));
  },
  registerMinimizedDialog(entry: MinimizedDialogEntry) {
    set((s) => ({
      ...s,
      minimizedDialogs: [...s.minimizedDialogs.filter((d) => d.id !== entry.id), entry],
    }));
  },
  updateMinimizedDialog(id: string, patch: Partial<MinimizedDialogEntry>) {
    set((s) => ({
      ...s,
      minimizedDialogs: s.minimizedDialogs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },
  unregisterMinimizedDialog(id: string) {
    set((s) => ({ ...s, minimizedDialogs: s.minimizedDialogs.filter((d) => d.id !== id) }));
  },
};