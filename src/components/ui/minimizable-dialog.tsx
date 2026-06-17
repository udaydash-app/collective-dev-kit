import * as React from "react";
import { FileText, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { windowActions } from "@/store/windowStore";
import { cn } from "@/lib/utils";

interface MinimizableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Called when the user explicitly closes from the taskbar context menu. */
  onDiscard?: () => void;
  /** Class applied to DialogContent. */
  className?: string;
  /** Optional explicit header — if omitted, a default DialogHeader/DialogTitle is rendered. */
  hideDefaultHeader?: boolean;
  children: React.ReactNode;
}

/**
 * Drop-in replacement for shadcn <Dialog> that adds a minimize button
 * (aligned with the X) and a taskbar entry while minimized.
 * The dialog's parent state (`open`) stays true while minimized, so
 * children remain mounted and form state is preserved.
 */
export function MinimizableDialog({
  open,
  onOpenChange,
  title,
  icon,
  onDiscard,
  className,
  hideDefaultHeader,
  children,
}: MinimizableDialogProps) {
  const [minimized, setMinimized] = React.useState(false);
  const idRef = React.useRef<string>(
    `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );

  // Reset minimized state when dialog actually closes
  React.useEffect(() => {
    if (!open) setMinimized(false);
  }, [open]);

  // Register / unregister in taskbar based on minimized state
  React.useEffect(() => {
    if (open && minimized) {
      windowActions.registerMinimizedDialog({
        id: idRef.current,
        title,
        icon: icon ?? FileText,
        onRestore: () => setMinimized(false),
        onClose: () => {
          setMinimized(false);
          onOpenChange(false);
          onDiscard?.();
        },
      });
      return () => windowActions.unregisterMinimizedDialog(idRef.current);
    }
  }, [open, minimized, title, icon, onOpenChange, onDiscard]);

  // Keep title in sync if it changes while minimized
  React.useEffect(() => {
    if (open && minimized) {
      windowActions.updateMinimizedDialog(idRef.current, { title, icon: icon ?? FileText });
    }
  }, [title, icon, open, minimized]);

  const handleOpenChange = (next: boolean) => {
    if (!next && minimized) return; // ignore close attempts while minimized
    onOpenChange(next);
  };

  return (
    <Dialog open={open && !minimized} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(className)}>
        <button
          type="button"
          className="absolute right-14 top-4 z-50 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-transparent p-0 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => setMinimized(true)}
          aria-label="Minimize"
          title="Minimize"
        >
          <Minus className="h-4 w-4 shrink-0" />
        </button>
        {!hideDefaultHeader && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}