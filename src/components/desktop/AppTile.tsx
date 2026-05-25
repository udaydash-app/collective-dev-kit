import { type AppDef } from '@/lib/appRegistry';
import { cn } from '@/lib/utils';

interface Props {
  app: AppDef;
  onOpen: (id: string) => void;
  variant?: 'desktop' | 'panel';
}

export function AppTile({ app, onOpen, variant = 'desktop' }: Props) {
  const Icon = app.icon;
  return (
    <button
      onDoubleClick={() => onOpen(app.id)}
      onClick={() => onOpen(app.id)}
      className={cn(
        'group flex flex-col items-center gap-2 w-24 p-2 rounded-lg focus:outline-none transition-colors',
        variant === 'desktop'
          ? 'hover:bg-white/10 focus-visible:bg-white/15'
          : 'hover:bg-accent focus-visible:bg-accent',
      )}
      aria-label={`Open ${app.title}`}
    >
      <div
        className={cn(
          'h-16 w-16 rounded-2xl bg-gradient-to-br shadow-lg flex items-center justify-center text-white group-hover:scale-105 group-active:scale-95 transition-transform',
          app.color ?? 'from-slate-500 to-slate-700',
        )}
      >
        <Icon className="h-8 w-8 drop-shadow" strokeWidth={2.2} />
      </div>
      <span
        className={cn(
          'text-xs text-center leading-tight line-clamp-2',
          variant === 'desktop' ? 'text-white/90 drop-shadow' : 'text-foreground',
        )}
      >
        {app.title}
      </span>
    </button>
  );
}