import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface KeyboardBadgeProps {
  keys: string | string[];
  className?: string;
  variant?: "default" | "secondary" | "outline";
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const formatKey = (key: string): string => {
  if (key === 'Ctrl' && isMac) return '⌘';
  if (key === 'Alt' && isMac) return '⌥';
  if (key === 'Shift') return '⇧';
  if (key === 'Meta') return '⌘';
  return key;
};

export const KeyboardBadge = ({ keys, className, variant = "secondary" }: KeyboardBadgeProps) => {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {keyArray.map((key, index) => (
        <Badge
          key={index}
          variant={variant}
          className="font-mono text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center"
        >
          {formatKey(key)}
        </Badge>
      ))}
    </div>
  );
};

export const KeyboardShortcutHint = ({ 
  keys, 
  className 
}: { 
  keys: string | string[]; 
  className?: string;
}) => {
  return (
    <span className={cn("text-xs text-muted-foreground ml-auto pl-2", className)}>
      <KeyboardBadge keys={keys} variant="outline" />
    </span>
  );
};
