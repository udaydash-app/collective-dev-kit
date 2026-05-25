import React, { Suspense } from 'react';
import { Rnd } from 'react-rnd';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Minus, Square, X, Maximize2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findAppById } from '@/lib/appRegistry';
import { windowActions, type WindowState } from '@/store/windowStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  win: WindowState;
  desktopBounds: { width: number; height: number };
  topZ: number;
}

export const AppWindow = React.memo(function AppWindow({ win, desktopBounds, topZ }: Props) {
  const app = findAppById(win.appId);
  if (!app) return null;

  const Icon = app.icon;
  const isFocused = win.zIndex === topZ;

  const geometry = win.maximized
    ? { x: 0, y: 0, width: desktopBounds.width, height: desktopBounds.height }
    : { x: win.x, y: win.y, width: win.width, height: win.height };

  const Component = app.component;

  return (
    <Rnd
      size={{ width: geometry.width, height: geometry.height }}
      position={{ x: geometry.x, y: geometry.y }}
      minWidth={480}
      minHeight={320}
      bounds="parent"
      dragHandleClassName="window-drag-handle"
      disableDragging={win.maximized}
      enableResizing={!win.maximized}
      onDragStop={(_, d) => windowActions.move(win.id, d.x, d.y)}
      onResizeStop={(_, __, ref, ___, position) =>
        windowActions.resize(win.id, ref.offsetWidth, ref.offsetHeight, position.x, position.y)
      }
      style={{
        zIndex: win.zIndex,
        display: win.minimized ? 'none' : 'flex',
      }}
      onMouseDownCapture={() => windowActions.focus(win.id)}
      className={cn(
        'flex flex-col rounded-lg overflow-hidden border bg-card shadow-2xl',
        isFocused ? 'border-primary/40 shadow-primary/20' : 'border-border/60',
      )}
    >
      {/* Title bar */}
      <div
        className={cn(
          'window-drag-handle h-9 flex items-center justify-between px-2 select-none cursor-grab active:cursor-grabbing',
          isFocused
            ? 'bg-gradient-to-r from-primary/90 to-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
        onDoubleClick={() => windowActions.toggleMaximize(win.id)}
      >
        <div className="flex items-center gap-2 px-1 truncate">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate">{app.title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); windowActions.minimize(win.id); }}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-background/20"
            aria-label="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); windowActions.toggleMaximize(win.id); }}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-background/20"
            aria-label="Maximize"
          >
            {win.maximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); windowActions.close(win.id); }}
            className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto bg-background">
        <ErrorBoundary>
          <MemoryRouter initialEntries={[app.path]}>
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              }
            >
              <Routes>
                <Route path={app.path} element={<Component />} />
                <Route path="*" element={<Component />} />
              </Routes>
            </Suspense>
          </MemoryRouter>
        </ErrorBoundary>
      </div>
    </Rnd>
  );
});