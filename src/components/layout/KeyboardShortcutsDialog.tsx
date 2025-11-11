import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ['Ctrl', 'K'], description: 'Open search', category: 'Navigation' },
  { keys: ['Ctrl', 'H'], description: 'Go to home', category: 'Navigation' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Go to cart', category: 'Navigation' },
  { keys: ['Ctrl', 'O'], description: 'Go to orders', category: 'Navigation' },
  { keys: ['Ctrl', 'P'], description: 'Go to profile', category: 'Navigation' },
  
  // General
  { keys: ['Escape'], description: 'Close dialog/modal', category: 'General' },
  { keys: ['Enter'], description: 'Submit form/Confirm', category: 'General' },
  { keys: ['Tab'], description: 'Next field', category: 'General' },
  { keys: ['Shift', 'Tab'], description: 'Previous field', category: 'General' },
  { keys: ['?'], description: 'Show this help', category: 'General' },
  
  // POS System
  { keys: ['F1'], description: 'Cash In', category: 'POS' },
  { keys: ['F2'], description: 'Cash Out', category: 'POS' },
  { keys: ['F3'], description: 'Hold Ticket', category: 'POS' },
  { keys: ['F4'], description: 'Recall Ticket', category: 'POS' },
  { keys: ['F9'], description: 'Process Payment', category: 'POS' },
  { keys: ['F12'], description: 'Clear Cart', category: 'POS' },
  
  // Lists & Selection
  { keys: ['↑'], description: 'Previous item', category: 'Lists' },
  { keys: ['↓'], description: 'Next item', category: 'Lists' },
  { keys: ['Enter'], description: 'Select highlighted item', category: 'Lists' },
];

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const formatKey = (key: string) => {
  if (key === 'Ctrl' && isMac) return '⌘';
  if (key === 'Alt' && isMac) return '⌥';
  if (key === 'Shift') return '⇧';
  if (key === 'Enter') return '↵';
  if (key === 'Escape') return 'Esc';
  return key;
};

export const KeyboardShortcutsDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShowShortcuts = () => setOpen(true);
    window.addEventListener('show-shortcuts', handleShowShortcuts);
    return () => window.removeEventListener('show-shortcuts', handleShowShortcuts);
  }, []);

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter(s => s.category === category)
                  .map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-xs">
                            {formatKey(key)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
              {category !== categories[categories.length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4">
          Press <Badge variant="secondary" className="font-mono mx-1">?</Badge> to toggle this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
};
